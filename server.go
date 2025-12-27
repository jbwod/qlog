package main

import (
	"embed"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/leodido/go-syslog/v4/rfc3164"
	"github.com/leodido/go-syslog/v4/rfc5424"
)

//go:embed web/*
var webFiles embed.FS

type Server struct {
	db              *Database
	config          *Config
	rfc5424Parser   interface{}
	rfc3164Parser   interface{}
	mu              sync.RWMutex
	stats           *ServerStats
	activeListeners map[string]ListenerControl // listener ID -> control
	listenerMu      sync.RWMutex
}

type ListenerControl struct {
	Stop func()
	Type string // "udp", "tcp", "tls"
}

type ServerStats struct {
	TotalMessages   int64
	MessagesByRFC   map[string]int64
	MessagesByProto map[string]int64
	LastMessageTime time.Time
	mu              sync.RWMutex
}

func NewServer(config *Config) (*Server, error) {
	db, err := NewDatabase(config.Database.Path)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize database: %w", err)
	}

	var rfc5424Parser interface{}
	var rfc3164Parser interface{}

	if config.Parsing.RFC5424Enabled {
		if config.Parsing.BestEffort {
			rfc5424Parser = rfc5424.NewParser(rfc5424.WithBestEffort())
		} else {
			rfc5424Parser = rfc5424.NewParser()
		}
	}

	if config.Parsing.RFC3164Enabled {
		if config.Parsing.BestEffort {
			rfc3164Parser = rfc3164.NewParser(rfc3164.WithBestEffort())
		} else {
			rfc3164Parser = rfc3164.NewParser()
		}
	}

	return &Server{
		db:            db,
		config:        config,
		rfc5424Parser: rfc5424Parser,
		rfc3164Parser: rfc3164Parser,
		stats: &ServerStats{
			MessagesByRFC:   make(map[string]int64),
			MessagesByProto: make(map[string]int64),
		},
		activeListeners: make(map[string]ListenerControl),
	}, nil
}

func (s *Server) Start() error {
	errChan := make(chan error, 5)

	// Clean expired sessions on startup
	s.db.CleanExpiredSessions()

	// Start periodic cleanup of expired sessions
	go s.cleanupExpiredSessions()

	// Start all enabled listeners from config
	if err := s.startListeners(); err != nil {
		log.Printf("Warning: Error starting some listeners: %v", err)
	}

	go func() {
		if err := s.startWebServer(); err != nil {
			errChan <- fmt.Errorf("web server error: %w", err)
		}
	}()

	return <-errChan
}

// cleanupExpiredSessions periodically removes expired sessions
func (s *Server) cleanupExpiredSessions() {
	ticker := time.NewTicker(1 * time.Hour) // Clean up every hour
	defer ticker.Stop()

	for range ticker.C {
		if err := s.db.CleanExpiredSessions(); err != nil {
			log.Printf("Error cleaning expired sessions: %v", err)
		}
	}
}

func (s *Server) Stop() error {
	s.listenerMu.Lock()
	defer s.listenerMu.Unlock()

	// Stop all active listeners
	for id, control := range s.activeListeners {
		log.Printf("Stopping listener %s...", id)
		control.Stop()
		delete(s.activeListeners, id)
	}

	if s.db != nil {
		return s.db.Close()
	}
	return nil
}

func (s *Server) Close() error {
	return s.Stop()
}

func (s *Server) startWebServer() error {
	// Create filesystem from embedded files
	webFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		return fmt.Errorf("failed to create web filesystem: %w", err)
	}

	// Create a mux to handle routing
	mux := http.NewServeMux()

	// Authentication routes (no auth required)
	mux.HandleFunc("/api/auth/setup", s.handleAuthSetup)
	mux.HandleFunc("/api/auth/login", s.handleAuthLogin)
	mux.HandleFunc("/api/auth/logout", s.handleAuthLogout)
	mux.HandleFunc("/api/auth/status", s.handleAuthStatus)
	mux.HandleFunc("/api/auth/login-history", s.requireAuth(s.handleLoginHistoryAPI))

	// Serve shared view page (no auth required)
	mux.HandleFunc("/shared", s.handleSharedViewPage)

	// Protected API routes (require authentication, except shared views)
	mux.HandleFunc("/api/logs", s.requireAuth(s.handleLogsAPI))
	mux.HandleFunc("/api/logs/", s.requireAuth(s.handleLogDetailAPI))
	mux.HandleFunc("/api/stats", s.requireAuth(s.handleStatsAPI))
	mux.HandleFunc("/api/clear", s.requireAuth(s.handleClearAPI))
	mux.HandleFunc("/api/search", s.requireAuth(s.handleSearchAPI))
	mux.HandleFunc("/api/config", s.requireAuth(s.handleConfigAPI))
	mux.HandleFunc("/api/config/limit", s.requireAuth(s.handleConfigLimitAPI))
	mux.HandleFunc("/api/config/reset", s.requireAuth(s.handleConfigResetAPI))
	mux.HandleFunc("/api/device-types", s.requireAuth(s.handleDeviceTypesAPI))
	mux.HandleFunc("/api/devices", s.requireAuth(s.handleDevicesAPI))
	mux.HandleFunc("/api/devices/", s.requireAuth(s.handleDeviceAPI))
	mux.HandleFunc("/api/severity-overrides", s.requireAuth(s.handleSeverityOverridesAPI))
	mux.HandleFunc("/api/severity-overrides/", s.requireAuth(s.handleSeverityOverrideAPI))
	mux.HandleFunc("/api/event-types", s.requireAuth(s.handleEventTypesAPI))
	mux.HandleFunc("/api/module-metadata", s.requireAuth(s.handleModuleMetadataAPI))
	mux.HandleFunc("/api/modules", s.requireAuth(s.handleModulesAPI))
	mux.HandleFunc("/api/listeners", s.requireAuth(s.handleListenersAPI))
	mux.HandleFunc("/api/listeners/", s.requireAuth(s.handleListenerAPI))
	mux.HandleFunc("/api/certs/upload", s.requireAuth(s.handleCertUploadAPI))
	mux.HandleFunc("/api/certs/validate", s.requireAuth(s.handleCertValidateAPI))
	mux.HandleFunc("/api/views", s.requireAuth(s.handleViewsAPI))
	mux.HandleFunc("/api/views/", s.requireAuth(s.handleViewAPI))
	mux.HandleFunc("/api/query", s.requireAuth(s.handleQueryAPI))
	mux.HandleFunc("/api/aggregate", s.requireAuth(s.handleAggregateAPI))
	mux.HandleFunc("/api/timeseries", s.requireAuth(s.handleTimeSeriesAPI))
	mux.HandleFunc("/api/server/info", s.requireAuth(s.handleServerInfoAPI))
	mux.HandleFunc("/api/config/export", s.requireAuth(s.handleConfigExportAPI))
	// Customization API - GET allowed without auth (for auth modal), POST requires auth
	mux.HandleFunc("/api/customization", s.handleCustomizationAPI)
	mux.HandleFunc("/api/customization/logo", s.requireAuth(s.handleLogoUploadAPI))
	mux.HandleFunc("/api/customization/favicon", s.requireAuth(s.handleFaviconUploadAPI))
	mux.HandleFunc("/api/clear-logs", s.requireAuth(s.handleClearLogsAPI))

	// Serve uploads directory
	mux.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("uploads"))))

	// Serve static files for everything else
	mux.Handle("/", http.FileServer(http.FS(webFS)))

	log.Printf("Web UI available at http://localhost:%d", s.config.Web.Port)
	return http.ListenAndServe(fmt.Sprintf(":%d", s.config.Web.Port), mux)
}
