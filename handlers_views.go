package main

import (
	"embed"
	"encoding/json"
	"net/http"
	"strings"
	"time"
)

//go:embed web/shared.html
var sharedHTMLFile embed.FS

// View-related API handlers

func (s *Server) handleViewsAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Shared views can only GET (read-only)
	if isSharedViewRequest(r) && r.Method != "GET" {
		http.Error(w, "write operations not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method == "GET" {
		if s.config.Views == nil {
			s.config.Views = []ViewConfig{}
		}
		json.NewEncoder(w).Encode(s.config.Views)
		return
	}

	if r.Method == "POST" {
		var view ViewConfig
		if err := json.NewDecoder(r.Body).Decode(&view); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Initialize views slice if nil
		if s.config.Views == nil {
			s.config.Views = []ViewConfig{}
		}

		// Add view
		s.config.Views = append(s.config.Views, view)

		// Save to file
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(view)
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleViewAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Shared views can only GET (read-only)
	if isSharedViewRequest(r) && r.Method != "GET" {
		http.Error(w, "write operations not allowed in shared view mode", http.StatusForbidden)
		return
	}

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		http.Error(w, "invalid view ID", http.StatusBadRequest)
		return
	}

	viewID := pathParts[2]

	if r.Method == "GET" {
		// Return specific view (for shared links) - read-only access
		if s.config.Views != nil {
			for _, view := range s.config.Views {
				if view.ID == viewID {
					// Return view data (read-only, no sensitive config)
					json.NewEncoder(w).Encode(view)
					return
				}
			}
		}
		http.Error(w, "view not found", http.StatusNotFound)
		return
	}

	// All other methods require authentication (not available in shared view mode)
	if isSharedViewRequest(r) {
		http.Error(w, "method not allowed in shared view mode", http.StatusMethodNotAllowed)
		return
	}

	if r.Method == "PUT" {
		var view ViewConfig
		if err := json.NewDecoder(r.Body).Decode(&view); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Find and update view
		if s.config.Views != nil {
			for i := range s.config.Views {
				if s.config.Views[i].ID == viewID {
					view.Updated = time.Now().Format(time.RFC3339)
					s.config.Views[i] = view
					if err := SaveConfig("config.json", s.config); err != nil {
						http.Error(w, err.Error(), http.StatusInternalServerError)
						return
					}
					json.NewEncoder(w).Encode(view)
					return
				}
			}
		}

		http.Error(w, "view not found", http.StatusNotFound)
		return
	}

	if r.Method == "DELETE" {
		if s.config.Views == nil {
			http.Error(w, "no views configured", http.StatusNotFound)
			return
		}

		// Find and remove view
		newViews := []ViewConfig{}
		found := false
		for _, view := range s.config.Views {
			if view.ID != viewID {
				newViews = append(newViews, view)
			} else {
				found = true
			}
		}

		if !found {
			http.Error(w, "view not found", http.StatusNotFound)
			return
		}

		s.config.Views = newViews

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

// Serve the shared view HTML page (isolated from main app)
func (s *Server) handleSharedViewPage(w http.ResponseWriter, r *http.Request) {
	// Only allow GET requests
	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	addSecurityHeaders(w)

	// Read from the embedded filesystem
	sharedHTML, err := sharedHTMLFile.ReadFile("web/shared.html")
	if err != nil {
		http.Error(w, "shared view page not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Write(sharedHTML)
}
