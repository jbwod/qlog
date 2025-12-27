package main

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Listener and certificate-related API handlers

func (s *Server) handleListenersAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	// Block shared views from accessing listeners
	if isSharedViewRequest(r) {
		http.Error(w, "listener access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method == "GET" {
		if s.config.Listeners == nil {
			s.config.Listeners = []ListenerConfig{}
		}
		json.NewEncoder(w).Encode(s.config.Listeners)
		return
	}

	if r.Method == "POST" {
		var listener ListenerConfig
		if err := json.NewDecoder(r.Body).Decode(&listener); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Validate port conflict - only check if another listener is actively using the port
		if s.config.Listeners != nil {
			for _, existing := range s.config.Listeners {
				if existing.Port == listener.Port && existing.ID != listener.ID {
					// Check if the existing listener is actually running
					s.listenerMu.RLock()
					_, isRunning := s.activeListeners[existing.ID]
					s.listenerMu.RUnlock()

					// Only block if the listener is actively running
					if isRunning {
						http.Error(w, fmt.Sprintf("port %d is already in use by running listener '%s'", listener.Port, existing.Name), http.StatusConflict)
						return
					}
				}
			}
		}

		// Generate ID if not provided
		if listener.ID == "" {
			listener.ID = fmt.Sprintf("listener-%d", time.Now().UnixNano())
		}

		// Initialize listeners slice if nil
		if s.config.Listeners == nil {
			s.config.Listeners = []ListenerConfig{}
		}

		// Default to disabled when creating
		listener.Enabled = false

		// Add listener
		s.config.Listeners = append(s.config.Listeners, listener)

		// Save to file
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(listener)
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleListenerAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	// Block shared views from accessing listeners
	if isSharedViewRequest(r) {
		http.Error(w, "listener access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		http.Error(w, "invalid listener ID", http.StatusBadRequest)
		return
	}

	listenerID := pathParts[2]

	if r.Method == "PUT" {
		var update struct {
			Enabled bool `json:"enabled"`
		}
		if err := json.NewDecoder(r.Body).Decode(&update); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Find and update listener
		if s.config.Listeners != nil {
			for i := range s.config.Listeners {
				if s.config.Listeners[i].ID == listenerID {
					oldEnabled := s.config.Listeners[i].Enabled
					s.config.Listeners[i].Enabled = update.Enabled

					// Start or stop the listener
					if update.Enabled && !oldEnabled {
						// Start the listener
						if err := s.startListener(s.config.Listeners[i]); err != nil {
							s.config.Listeners[i].Enabled = false // Revert on error
							http.Error(w, fmt.Sprintf("failed to start listener: %v", err), http.StatusInternalServerError)
							return
						}
					} else if !update.Enabled && oldEnabled {
						// Stop the listener
						if err := s.stopListener(listenerID); err != nil {
							log.Printf("Warning: failed to stop listener %s: %v", listenerID, err)
						}
					}

					if err := SaveConfig("config.json", s.config); err != nil {
						http.Error(w, err.Error(), http.StatusInternalServerError)
						return
					}
					json.NewEncoder(w).Encode(s.config.Listeners[i])
					return
				}
			}
		}

		http.Error(w, "listener not found", http.StatusNotFound)
		return
	}

	if r.Method == "DELETE" {
		if s.config.Listeners == nil {
			http.Error(w, "no listeners configured", http.StatusNotFound)
			return
		}

		// Stop listener if running
		s.stopListener(listenerID)

		// Find and remove listener
		newListeners := []ListenerConfig{}
		found := false
		for _, listener := range s.config.Listeners {
			if listener.ID != listenerID {
				newListeners = append(newListeners, listener)
			} else {
				found = true
			}
		}

		if !found {
			http.Error(w, "listener not found", http.StatusNotFound)
			return
		}

		s.config.Listeners = newListeners

		// Remove devices bound to this listener
		if s.config.Devices != nil {
			newDevices := []DeviceConfig{}
			for _, device := range s.config.Devices {
				if device.ListenerID != listenerID {
					newDevices = append(newDevices, device)
				}
			}
			s.config.Devices = newDevices
		}

		// Save to file
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleCertUploadAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	// Block shared views from uploading certificates
	if isSharedViewRequest(r) {
		http.Error(w, "certificate upload not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse multipart form (32MB max)
	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "failed to parse form: "+err.Error(), http.StatusBadRequest)
		return
	}

	fileType := r.FormValue("type") // "cert", "key", or "ca"
	if fileType == "" {
		http.Error(w, "file type required", http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "failed to get file: "+err.Error(), http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Create certs directory if it doesn't exist
	certsDir := "certs"
	if err := os.MkdirAll(certsDir, 0755); err != nil {
		http.Error(w, "failed to create certs directory: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Generate unique filename
	filename := fmt.Sprintf("%s-%d-%s", fileType, time.Now().UnixNano(), header.Filename)
	filepath := filepath.Join(certsDir, filename)

	// Save file
	dst, err := os.Create(filepath)
	if err != nil {
		http.Error(w, "failed to save file: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		http.Error(w, "failed to write file: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Validate certificate if it's a cert file
	if fileType == "cert" || fileType == "ca" {
		if err := s.validateCertificate(filepath); err != nil {
			os.Remove(filepath) // Remove invalid cert
			http.Error(w, "invalid certificate: "+err.Error(), http.StatusBadRequest)
			return
		}
	}

	json.NewEncoder(w).Encode(map[string]string{
		"status": "success",
		"path":   filepath,
		"name":   header.Filename,
	})
}

func (s *Server) handleCertValidateAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	
	// Block shared views from validating certificates
	if isSharedViewRequest(r) {
		http.Error(w, "certificate validation not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		CertFile string `json:"cert_file"`
		KeyFile  string `json:"key_file"`
		CaFile   string `json:"ca_file,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate certificate
	if err := s.validateCertificate(req.CertFile); err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": false,
			"error": err.Error(),
		})
		return
	}

	// Get certificate details (we can do this even without key)
	certInfo, err := s.getCertificateInfo(req.CertFile)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"valid": false,
			"error": "failed to read certificate: " + err.Error(),
		})
		return
	}

	// Try to load key pair if key file is provided
	keyPairValid := false
	if req.KeyFile != "" {
		_, err := tls.LoadX509KeyPair(req.CertFile, req.KeyFile)
		if err == nil {
			keyPairValid = true
		}
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"valid": keyPairValid,
		"info":  certInfo,
	})
}

func (s *Server) validateCertificate(certPath string) error {
	certPEM, err := os.ReadFile(certPath)
	if err != nil {
		return fmt.Errorf("failed to read certificate: %w", err)
	}

	block, _ := pem.Decode(certPEM)
	if block == nil {
		return fmt.Errorf("failed to decode PEM block")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Check if certificate is expired
	if cert.NotAfter.Before(time.Now()) {
		return fmt.Errorf("certificate expired on %s", cert.NotAfter.Format(time.RFC3339))
	}

	// Check if certificate is not yet valid
	if cert.NotBefore.After(time.Now()) {
		return fmt.Errorf("certificate not valid until %s", cert.NotBefore.Format(time.RFC3339))
	}

	return nil
}

func (s *Server) getCertificateInfo(certPath string) (map[string]interface{}, error) {
	certPEM, err := os.ReadFile(certPath)
	if err != nil {
		return nil, err
	}

	block, _ := pem.Decode(certPEM)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}

	info := map[string]interface{}{
		"subject":       cert.Subject.String(),
		"issuer":        cert.Issuer.String(),
		"not_before":    cert.NotBefore.Format(time.RFC3339),
		"not_after":     cert.NotAfter.Format(time.RFC3339),
		"serial_number": cert.SerialNumber.String(),
		"dns_names":     cert.DNSNames,
		"ip_addresses":  cert.IPAddresses,
	}

	return info, nil
}

