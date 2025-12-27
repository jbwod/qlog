package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

// Configuration-related API handlers

func (s *Server) handleConfigAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing config
	if isSharedViewRequest(r) {
		http.Error(w, "config access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method == "GET" {
		// Return current config
		json.NewEncoder(w).Encode(s.config)
		return
	}

	if r.Method == "POST" {
		var newConfig struct {
			Servers struct {
				UDP struct {
					Enabled bool   `json:"enabled"`
					Port    int    `json:"port"`
					RFC     string `json:"rfc"`
				} `json:"udp"`
				TCP struct {
					Enabled bool   `json:"enabled"`
					Port    int    `json:"port"`
					RFC     string `json:"rfc"`
					Framing string `json:"framing"`
					Parser  string `json:"parser"`
				} `json:"tcp"`
				TLS struct {
					Enabled  bool   `json:"enabled"`
					Port     int    `json:"port"`
					RFC      string `json:"rfc"`
					Framing  string `json:"framing"`
					Parser   string `json:"parser"`
					CertFile string `json:"cert_file"`
					KeyFile  string `json:"key_file"`
				} `json:"tls"`
			} `json:"servers"`
		}

		if err := json.NewDecoder(r.Body).Decode(&newConfig); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Update config
		s.config.Servers.UDP.Enabled = newConfig.Servers.UDP.Enabled
		s.config.Servers.UDP.Port = newConfig.Servers.UDP.Port
		s.config.Servers.TCP.Enabled = newConfig.Servers.TCP.Enabled
		s.config.Servers.TCP.Port = newConfig.Servers.TCP.Port
		s.config.Servers.TLS.Enabled = newConfig.Servers.TLS.Enabled
		s.config.Servers.TLS.Port = newConfig.Servers.TLS.Port
		s.config.Servers.TLS.CertFile = newConfig.Servers.TLS.CertFile
		s.config.Servers.TLS.KeyFile = newConfig.Servers.TLS.KeyFile

		// Save to file
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "saved"})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleConfigLimitAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing config
	if isSharedViewRequest(r) {
		http.Error(w, "config access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method == "GET" {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"limit": s.config.Database.Limit,
		})
		return
	}

	if r.Method == "POST" {
		var req struct {
			Limit int `json:"limit"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		s.config.Database.Limit = req.Limit
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"limit": s.config.Database.Limit,
		})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleConfigResetAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from resetting config
	if isSharedViewRequest(r) {
		http.Error(w, "config reset not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Reset to default config - reload from empty path to get defaults
	defaultConfig, err := LoadConfig("")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	s.config = defaultConfig
	if err := SaveConfig("config.json", s.config); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "reset"})
}

func (s *Server) handleConfigExportAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing config
	if isSharedViewRequest(r) {
		http.Error(w, "config access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	json.NewEncoder(w).Encode(s.config)
}

func (s *Server) handleCustomizationAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing customization
	if isSharedViewRequest(r) {
		http.Error(w, "customization access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	// Allow GET requests without auth (needed for auth modal)
	if r.Method == "GET" {
		json.NewEncoder(w).Encode(s.config.Customization)
		return
	}

	// POST requests require authentication (handled by requireAuth middleware)

	if r.Method == "POST" {
		var customization CustomizationConfig
		if err := json.NewDecoder(r.Body).Decode(&customization); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Preserve existing logo/favicon paths if not being updated
		if s.config.Customization != nil {
			if customization.BrandLogo == "" {
				customization.BrandLogo = s.config.Customization.BrandLogo
			}
			if customization.Favicon == "" {
				customization.Favicon = s.config.Customization.Favicon
			}
		}

		s.config.Customization = &customization
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(s.config.Customization)
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// Handle logo upload
func (s *Server) handleLogoUploadAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from uploading logos
	if isSharedViewRequest(r) {
		http.Error(w, "logo upload not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (10MB max for images)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "failed to parse multipart form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("logo")
	if err != nil {
		http.Error(w, "failed to get file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if contentType != "image/png" && contentType != "image/jpeg" && contentType != "image/jpg" && contentType != "image/svg+xml" && contentType != "image/gif" && contentType != "image/webp" {
		http.Error(w, "invalid file type. Only images (PNG, JPEG, SVG, GIF, WebP) are allowed", http.StatusBadRequest)
		return
	}

	// Create uploads directory if it doesn't exist
	uploadsDir := "uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		http.Error(w, "failed to create uploads directory: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate filename
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		// Try to determine extension from content type
		switch contentType {
		case "image/png":
			ext = ".png"
		case "image/jpeg", "image/jpg":
			ext = ".jpg"
		case "image/svg+xml":
			ext = ".svg"
		case "image/gif":
			ext = ".gif"
		case "image/webp":
			ext = ".webp"
		default:
			ext = ".png"
		}
	}
	filename := fmt.Sprintf("logo-%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadsDir, filename)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "failed to save file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "failed to save file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Update customization config
	if s.config.Customization == nil {
		s.config.Customization = &CustomizationConfig{}
	}
	s.config.Customization.BrandLogo = "/uploads/" + filename

	// Save config
	if err := SaveConfig("config.json", s.config); err != nil {
		http.Error(w, "failed to save config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
		"path":   s.config.Customization.BrandLogo,
	})
}

// Handle favicon upload
func (s *Server) handleFaviconUploadAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from uploading favicons
	if isSharedViewRequest(r) {
		http.Error(w, "favicon upload not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (5MB max for favicons)
	if err := r.ParseMultipartForm(5 << 20); err != nil {
		http.Error(w, "failed to parse multipart form: "+err.Error(), http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("favicon")
	if err != nil {
		http.Error(w, "failed to get file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Validate file type
	contentType := header.Header.Get("Content-Type")
	if contentType != "image/png" && contentType != "image/x-icon" && contentType != "image/vnd.microsoft.icon" && contentType != "image/svg+xml" {
		http.Error(w, "invalid file type. Only PNG, ICO, or SVG are allowed for favicons", http.StatusBadRequest)
		return
	}

	// Create uploads directory if it doesn't exist
	uploadsDir := "uploads"
	if err := os.MkdirAll(uploadsDir, 0755); err != nil {
		http.Error(w, "failed to create uploads directory: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate filename
	ext := filepath.Ext(header.Filename)
	if ext == "" {
		switch contentType {
		case "image/png":
			ext = ".png"
		case "image/x-icon", "image/vnd.microsoft.icon":
			ext = ".ico"
		case "image/svg+xml":
			ext = ".svg"
		default:
			ext = ".ico"
		}
	}
	filename := fmt.Sprintf("favicon-%d%s", time.Now().UnixNano(), ext)
	filePath := filepath.Join(uploadsDir, filename)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "failed to save file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "failed to save file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Update customization config
	if s.config.Customization == nil {
		s.config.Customization = &CustomizationConfig{}
	}
	s.config.Customization.Favicon = "/uploads/" + filename

	// Save config
	if err := SaveConfig("config.json", s.config); err != nil {
		http.Error(w, "failed to save config: "+err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
		"path":   s.config.Customization.Favicon,
	})
}

func (s *Server) handleClearLogsAPI(w http.ResponseWriter, r *http.Request) {
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
