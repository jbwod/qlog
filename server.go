package main

import (
	"bufio"
	"crypto/tls"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"qlog/modules"

	"github.com/leodido/go-syslog/v4/octetcounting"
	"github.com/leodido/go-syslog/v4/rfc3164"
	"github.com/leodido/go-syslog/v4/rfc5424"
)

//go:embed web/*
var webFiles embed.FS

type Server struct {
	db            *Database
	config        *Config
	rfc5424Parser interface{}
	rfc3164Parser interface{}
	mu            sync.RWMutex
	stats         *ServerStats
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
	}, nil
}

func (s *Server) Start() error {
	errChan := make(chan error, 5)

	if s.config.Servers.UDP.Enabled {
		go func() {
			if err := s.handleUDP(); err != nil {
				errChan <- fmt.Errorf("udp server error: %w", err)
			}
		}()
	}

	if s.config.Servers.TCP.Enabled {
		go func() {
			if err := s.handleTCP(); err != nil {
				errChan <- fmt.Errorf("tcp server error: %w", err)
			}
		}()
	}

	if s.config.Servers.TLS.Enabled {
		go func() {
			if err := s.handleTLS(); err != nil {
				errChan <- fmt.Errorf("tls server error: %w", err)
			}
		}()
	}

	go func() {
		if err := s.startWebServer(); err != nil {
			errChan <- fmt.Errorf("web server error: %w", err)
		}
	}()

	return <-errChan
}

func (s *Server) handleUDP() error {
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", s.config.Servers.UDP.Port))
	if err != nil {
		return err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return err
	}
	defer conn.Close()

	log.Printf("UDP syslog server listening on port %d", s.config.Servers.UDP.Port)

	buffer := make([]byte, 65535)
	for {
		n, remoteAddr, err := conn.ReadFromUDP(buffer)
		if err != nil {
			log.Printf("UDP read error: %v", err)
			continue
		}

		go s.processMessage(buffer[:n], remoteAddr.String(), "UDP", "RFC5426")
	}
}

func (s *Server) handleTCP() error {
	addr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf(":%d", s.config.Servers.TCP.Port))
	if err != nil {
		return err
	}

	listener, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return err
	}
	defer listener.Close()

	log.Printf("TCP syslog server listening on port %d (non-transparent framing)", s.config.Servers.TCP.Port)

	for {
		conn, err := listener.AcceptTCP()
		if err != nil {
			log.Printf("TCP accept error: %v", err)
			continue
		}

		go s.handleTCPConnection(conn, "TCP")
	}
}

func (s *Server) handleTCPConnection(conn *net.TCPConn, protocol string) {
	defer conn.Close()
	remoteAddr := conn.RemoteAddr().String()

	// Try non-transparent framing first
	scanner := bufio.NewScanner(conn)
	scanner.Buffer(make([]byte, 65535), 65535)

	for scanner.Scan() {
		data := scanner.Bytes()
		if len(data) > 0 {
			s.processMessage(data, remoteAddr, protocol, "RFC6587-NT")
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		log.Printf("TCP connection error: %v", err)
	}
}

func (s *Server) handleTLS() error {
	if s.config.Servers.TLS.CertFile == "" || s.config.Servers.TLS.KeyFile == "" {
		return fmt.Errorf("tls enabled but cert_file or key_file not specified")
	}

	cert, err := tls.LoadX509KeyPair(s.config.Servers.TLS.CertFile, s.config.Servers.TLS.KeyFile)
	if err != nil {
		return fmt.Errorf("failed to load TLS certificate: %w", err)
	}

	config := &tls.Config{
		Certificates: []tls.Certificate{cert},
	}

	addr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf(":%d", s.config.Servers.TLS.Port))
	if err != nil {
		return err
	}

	listener, err := tls.Listen("tcp", addr.String(), config)
	if err != nil {
		return err
	}
	defer listener.Close()

	log.Printf("TLS syslog server listening on port %d (octet counting)", s.config.Servers.TLS.Port)

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("TLS accept error: %v", err)
			continue
		}

		go s.handleTLSConnection(conn)
	}
}

func (s *Server) handleTLSConnection(conn net.Conn) {
	defer conn.Close()
	remoteAddr := conn.RemoteAddr().String()

	// Use octet counting scanner for TLS (RFC5425)
	scanner := octetcounting.NewScanner(conn, 65535)
	defer scanner.Release()

	for {
		token := scanner.Scan()
		tokenStr := token.String()

		// Check if we got a valid token (empty string means EOF or error)
		if tokenStr == "" {
			break
		}

		tokenBytes := []byte(tokenStr)

		// Parse the message using RFC5424 parser
		if s.rfc5424Parser != nil {
			parser, ok := s.rfc5424Parser.(interface {
				Parse([]byte) (interface{}, error)
			})
			if ok {
				msg, err := parser.Parse(tokenBytes)
				if err == nil {
					if rfc5424Msg, ok := msg.(*rfc5424.SyslogMessage); ok && rfc5424Msg != nil {
						entry := s.messageToEntry(rfc5424Msg, remoteAddr, "TLS", "RFC5425")
						s.saveLog(entry, "TLS", "RFC5425")
						continue
					}
				}
			}
		}

		// If parsing failed, save raw message
		entry := &LogEntry{
			Timestamp:      time.Now(),
			RemoteAddr:     remoteAddr,
			RawMessage:     tokenStr,
			StructuredData: make(map[string]map[string]string),
			ParsedFields:   make(map[string]interface{}),
			Severity:       6,   // Default to Informational if not parsed
			Priority:       165, // Default priority (local0.notice)
			Facility:       20,  // local0
		}

		// Try to extract priority from raw message if it starts with <PRI>
		if len(tokenStr) > 0 && tokenStr[0] == '<' {
			priEnd := strings.Index(tokenStr, ">")
			if priEnd > 0 && priEnd < 5 {
				if pri, err := strconv.ParseUint(tokenStr[1:priEnd], 10, 8); err == nil {
					entry.Priority = uint8(pri)
					entry.Facility = uint8(pri) / 8
					entry.Severity = uint8(pri) % 8
				}
			}
		}

		// Try to parse with device modules
		parsed := modules.GetRegistry().ParseLog(tokenStr, entry.Timestamp, entry.Severity, entry.Priority)
		if parsed.DeviceType != "unknown" {
			entry.DeviceType = parsed.DeviceType
			entry.EventType = parsed.EventType
			entry.EventCategory = parsed.EventCategory
			entry.ParsedFields = parsed.Fields
		}

		s.saveLog(entry, "TLS", "RFC5425")
	}
}

func (s *Server) processMessage(data []byte, remoteAddr, protocol, rfcFormat string) {
	// Log received message for debugging
	log.Printf("Received message from %s (%d bytes): %s", remoteAddr, len(data), string(data)[:min(len(data), 100)])

	// Try RFC5424 first
	if s.rfc5424Parser != nil {
		parser, ok := s.rfc5424Parser.(interface {
			Parse([]byte) (interface{}, error)
		})
		if ok {
			msg, err := parser.Parse(data)
			if err == nil {
				if rfc5424Msg, ok := msg.(*rfc5424.SyslogMessage); ok && rfc5424Msg != nil {
					entry := s.messageToEntry(rfc5424Msg, remoteAddr, protocol, "RFC5424")
					s.saveLog(entry, protocol, "RFC5424")
					return
				}
			}
		}
	}

	// Try RFC3164
	if s.rfc3164Parser != nil {
		parser, ok := s.rfc3164Parser.(interface {
			Parse([]byte) (interface{}, error)
		})
		if ok {
			msg, err := parser.Parse(data)
			if err == nil {
				if rfc3164Msg, ok := msg.(*rfc3164.SyslogMessage); ok && rfc3164Msg != nil {
					entry := s.rfc3164ToEntry(rfc3164Msg, remoteAddr, protocol)
					s.saveLog(entry, protocol, "RFC3164")
					return
				}
			}
		}
	}

	// If parsing failed, save raw message
	entry := &LogEntry{
		Timestamp:      time.Now(),
		RemoteAddr:     remoteAddr,
		RawMessage:     string(data),
		StructuredData: make(map[string]map[string]string),
		ParsedFields:   make(map[string]interface{}),
		Severity:       6,   // Default to Informational if not parsed
		Priority:       165, // Default priority (local0.notice)
		Facility:       20,  // local0
	}

	// Try to extract priority from raw message if it starts with <PRI>
	if len(data) > 0 && data[0] == '<' {
		// Look for priority in format <PRI>
		priEnd := strings.Index(string(data), ">")
		if priEnd > 0 && priEnd < 5 {
			if pri, err := strconv.ParseUint(string(data[1:priEnd]), 10, 8); err == nil {
				entry.Priority = uint8(pri)
				entry.Facility = uint8(pri) / 8
				entry.Severity = uint8(pri) % 8
			}
		}
	}

	// Try to parse with device modules
	parsed := modules.GetRegistry().ParseLog(string(data), entry.Timestamp, entry.Severity, entry.Priority)
	if parsed.DeviceType != "unknown" {
		entry.DeviceType = parsed.DeviceType
		entry.EventType = parsed.EventType
		entry.EventCategory = parsed.EventCategory
		entry.ParsedFields = parsed.Fields
	}

	s.saveLog(entry, protocol, "UNKNOWN")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (s *Server) messageToEntry(message *rfc5424.SyslogMessage, remoteAddr, protocol, rfcFormat string) *LogEntry {
	entry := &LogEntry{
		Timestamp:      time.Now(),
		RemoteAddr:     remoteAddr,
		RawMessage:     "",
		StructuredData: make(map[string]map[string]string),
	}

	if message.Priority != nil {
		entry.Priority = *message.Priority
		entry.Facility = *message.Facility
		entry.Severity = *message.Severity
	}
	entry.Version = message.Version

	if message.Hostname != nil {
		entry.Hostname = *message.Hostname
	}
	if message.Appname != nil {
		entry.AppName = *message.Appname
	}
	if message.ProcID != nil {
		entry.ProcID = *message.ProcID
	}
	if message.MsgID != nil {
		entry.MsgID = *message.MsgID
	}
	if message.Message != nil {
		entry.Message = *message.Message
	}
	if message.StructuredData != nil {
		entry.StructuredData = *message.StructuredData
	}
	if message.Timestamp != nil {
		entry.Timestamp = *message.Timestamp
	}

	return entry
}

func (s *Server) rfc3164ToEntry(message *rfc3164.SyslogMessage, remoteAddr, protocol string) *LogEntry {
	entry := &LogEntry{
		Timestamp:      time.Now(),
		RemoteAddr:     remoteAddr,
		RawMessage:     "",
		StructuredData: make(map[string]map[string]string),
		Version:        0, // RFC3164 doesn't have version
	}

	if message.Priority != nil {
		entry.Priority = *message.Priority
		entry.Facility = *message.Facility
		entry.Severity = *message.Severity
	}

	if message.Hostname != nil {
		entry.Hostname = *message.Hostname
	}
	if message.Appname != nil {
		entry.AppName = *message.Appname
	}
	if message.ProcID != nil {
		entry.ProcID = *message.ProcID
	}
	if message.Message != nil {
		entry.Message = *message.Message
	}
	if message.Timestamp != nil {
		entry.Timestamp = *message.Timestamp
	}

	entry.ParsedFields = make(map[string]interface{})

	// Try to parse with device modules
	parsed := modules.GetRegistry().ParseLog(entry.RawMessage, entry.Timestamp, entry.Severity, entry.Priority)
	if parsed.DeviceType != "unknown" {
		entry.DeviceType = parsed.DeviceType
		entry.EventType = parsed.EventType
		entry.EventCategory = parsed.EventCategory
		entry.ParsedFields = parsed.Fields
	}

	return entry
}

func (s *Server) saveLog(entry *LogEntry, protocol, rfcFormat string) {
	if err := s.db.InsertLog(entry, protocol, rfcFormat); err != nil {
		log.Printf("Failed to save log: %v", err)
		return
	}

	log.Printf("Saved log: %s (Device: %s, Event: %s)", entry.RawMessage[:min(len(entry.RawMessage), 50)], entry.DeviceType, entry.EventType)

	// Update stats
	s.stats.mu.Lock()
	s.stats.TotalMessages++
	s.stats.MessagesByRFC[rfcFormat]++
	s.stats.MessagesByProto[protocol]++
	s.stats.LastMessageTime = time.Now()
	s.stats.mu.Unlock()
}

func (s *Server) startWebServer() error {
	// Create filesystem from embedded files
	webFS, err := fs.Sub(webFiles, "web")
	if err != nil {
		return fmt.Errorf("failed to create web filesystem: %w", err)
	}

	// Create a mux to handle routing
	mux := http.NewServeMux()

	// API routes (register first so they take precedence)
	mux.HandleFunc("/api/logs", s.handleLogsAPI)
	mux.HandleFunc("/api/logs/", s.handleLogDetailAPI)
	mux.HandleFunc("/api/stats", s.handleStatsAPI)
	mux.HandleFunc("/api/clear", s.handleClearAPI)
	mux.HandleFunc("/api/search", s.handleSearchAPI)

	// Serve static files for everything else
	mux.Handle("/", http.FileServer(http.FS(webFS)))

	log.Printf("Web UI available at http://localhost:%d", s.config.Web.Port)
	return http.ListenAndServe(fmt.Sprintf(":%d", s.config.Web.Port), mux)
}

func (s *Server) handleLogsAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	limit := 100
	offset := 0
	var severity *uint8

	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			limit = l
		}
	}
	if offsetStr := r.URL.Query().Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil {
			offset = o
		}
	}
	if sevStr := r.URL.Query().Get("severity"); sevStr != "" {
		if sev, err := strconv.ParseUint(sevStr, 10, 8); err == nil {
			sev8 := uint8(sev)
			severity = &sev8
		}
	}

	hostname := r.URL.Query().Get("hostname")
	appname := r.URL.Query().Get("appname")
	search := r.URL.Query().Get("search")

	logs, err := s.db.GetLogs(limit, offset, severity, hostname, appname, search)
	if err != nil {
		log.Printf("Error fetching logs: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	log.Printf("API: Returning %d logs (limit=%d, offset=%d)", len(logs), limit, offset)
	if err := json.NewEncoder(w).Encode(logs); err != nil {
		log.Printf("Error encoding logs: %v", err)
	}
}

func (s *Server) handleLogDetailAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		http.Error(w, "invalid log ID", http.StatusBadRequest)
		return
	}

	id, err := strconv.ParseInt(pathParts[2], 10, 64)
	if err != nil {
		http.Error(w, "invalid log ID", http.StatusBadRequest)
		return
	}

	logEntry, err := s.db.GetLogByID(id)
	if err != nil {
		http.Error(w, "log not found", http.StatusNotFound)
		return
	}

	// Get display info from module system
	parsed := &modules.ParsedLog{
		DeviceType:    logEntry.DeviceType,
		EventType:     logEntry.EventType,
		EventCategory: logEntry.EventCategory,
		Fields:        logEntry.ParsedFields,
		RawMessage:    logEntry.RawMessage,
		Timestamp:     logEntry.Timestamp,
		Severity:      logEntry.GetSeverityName(),
		Priority:      int(logEntry.Priority),
	}

	displayInfo := modules.GetRegistry().GetDisplayInfo(parsed)

	response := map[string]interface{}{
		"log":          logEntry,
		"display_info": displayInfo,
	}

	json.NewEncoder(w).Encode(response)
}

func (s *Server) handleStatsAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	stats, err := s.db.GetStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Add server stats
	s.stats.mu.RLock()
	stats["server_total"] = s.stats.TotalMessages
	stats["server_by_rfc"] = s.stats.MessagesByRFC
	stats["server_by_proto"] = s.stats.MessagesByProto
	stats["last_message"] = s.stats.LastMessageTime
	s.stats.mu.RUnlock()

	json.NewEncoder(w).Encode(stats)
}

func (s *Server) handleSearchAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	search := r.URL.Query().Get("q")
	if search == "" {
		http.Error(w, "search query required", http.StatusBadRequest)
		return
	}

	logs, err := s.db.GetLogs(100, 0, nil, "", "", search)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(logs)
}

func (s *Server) handleClearAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := s.db.ClearLogs(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Reset stats
	s.stats.mu.Lock()
	s.stats.TotalMessages = 0
	s.stats.MessagesByRFC = make(map[string]int64)
	s.stats.MessagesByProto = make(map[string]int64)
	s.stats.mu.Unlock()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "cleared"})
}

func (s *Server) Close() error {
	return s.db.Close()
}
