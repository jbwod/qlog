package main

import (
	"encoding/json"
	"net/http"
	"strings"

	"qlog/modules"
)

// Device-related API handlers

func (s *Server) handleDeviceTypesAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing device types
	if isSharedViewRequest(r) {
		http.Error(w, "device type access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get device types - start with generic
	deviceTypes := []map[string]string{
		{
			"id":          "generic",
			"name":        "Generic",
			"description": "Default parser for unknown device types",
		},
	}

	// Add device types from registered modules
	registry := modules.GetRegistry()
	moduleTypes := registry.GetDeviceTypes()
	for _, mt := range moduleTypes {
		desc := ""
		if mt["id"] == "meraki" {
			desc = "Cisco Meraki devices (MX, MS, MR, MV, MG, MT)"
		} else if mt["id"] == "ubiquiti" {
			desc = "Ubiquiti UniFi devices"
		}
		deviceTypes = append(deviceTypes, map[string]string{
			"id":          mt["id"],
			"name":        mt["name"],
			"description": desc,
		})
	}

	json.NewEncoder(w).Encode(deviceTypes)
}

func (s *Server) handleDevicesAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing devices
	if isSharedViewRequest(r) {
		http.Error(w, "device access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method == "GET" {
		if s.config.Devices == nil {
			s.config.Devices = []DeviceConfig{}
		}
		json.NewEncoder(w).Encode(s.config.Devices)
		return
	}

	if r.Method == "POST" {
		var device DeviceConfig
		if err := json.NewDecoder(r.Body).Decode(&device); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Initialize devices slice if nil
		if s.config.Devices == nil {
			s.config.Devices = []DeviceConfig{}
		}

		// Add device
		s.config.Devices = append(s.config.Devices, device)

		// Save to file
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// If device has a listener and it's enabled, restart listeners
		if device.ListenerID != "" {
			go s.startListeners()
		}

		json.NewEncoder(w).Encode(device)
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleDeviceAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing devices
	if isSharedViewRequest(r) {
		http.Error(w, "device access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		http.Error(w, "invalid device ID", http.StatusBadRequest)
		return
	}

	deviceID := pathParts[2]

	if r.Method == "PUT" {
		var device DeviceConfig
		if err := json.NewDecoder(r.Body).Decode(&device); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Find and update device
		if s.config.Devices != nil {
			for i := range s.config.Devices {
				if s.config.Devices[i].ID == deviceID {
					s.config.Devices[i] = device
					if err := SaveConfig("config.json", s.config); err != nil {
						http.Error(w, err.Error(), http.StatusInternalServerError)
						return
					}

					// Restart listeners if device has a listener
					if device.ListenerID != "" {
						go s.startListeners()
					}

					json.NewEncoder(w).Encode(device)
					return
				}
			}
		}

		http.Error(w, "device not found", http.StatusNotFound)
		return
	}

	if r.Method == "DELETE" {
		if s.config.Devices == nil {
			http.Error(w, "no devices configured", http.StatusNotFound)
			return
		}

		// Find and remove device
		newDevices := []DeviceConfig{}
		found := false
		for _, device := range s.config.Devices {
			if device.ID != deviceID {
				newDevices = append(newDevices, device)
			} else {
				found = true
			}
		}

		if !found {
			http.Error(w, "device not found", http.StatusNotFound)
			return
		}

		s.config.Devices = newDevices

		// Save to file
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		// Restart listeners
		go s.startListeners()

		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleSeverityOverridesAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method == "GET" {
		if s.config.SeverityOverrides == nil {
			s.config.SeverityOverrides = make(map[string]uint8)
		}
		json.NewEncoder(w).Encode(s.config.SeverityOverrides)
		return
	}

	if r.Method == "POST" {
		var overrides map[string]uint8
		if err := json.NewDecoder(r.Body).Decode(&overrides); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		s.config.SeverityOverrides = overrides
		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(s.config.SeverityOverrides)
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleSeverityOverrideAPI(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		http.Error(w, "invalid event type", http.StatusBadRequest)
		return
	}

	eventType := pathParts[2]

	if r.Method == "PUT" {
		var req struct {
			Severity uint8 `json:"severity"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if s.config.SeverityOverrides == nil {
			s.config.SeverityOverrides = make(map[string]uint8)
		}
		s.config.SeverityOverrides[eventType] = req.Severity

		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"event_type": eventType,
			"severity":   req.Severity,
		})
		return
	}

	if r.Method == "DELETE" {
		if s.config.SeverityOverrides == nil {
			http.Error(w, "no severity overrides configured", http.StatusNotFound)
			return
		}

		if _, exists := s.config.SeverityOverrides[eventType]; !exists {
			http.Error(w, "severity override not found", http.StatusNotFound)
			return
		}

		delete(s.config.SeverityOverrides, eventType)

		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func (s *Server) handleEventTypesAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing event types (not needed for shared views)
	if isSharedViewRequest(r) {
		http.Error(w, "event type access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get unique event types from database
	eventTypes, err := s.db.GetEventTypes()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(eventTypes)
}

// Get module status and allow enabling/disabling
func (s *Server) handleModulesAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing modules
	if isSharedViewRequest(r) {
		http.Error(w, "module access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	registry := modules.GetRegistry()

	if r.Method == "GET" {
		// Return all modules with their enabled status
		allModules := registry.GetAllModuleMetadata()
		enabledModules := registry.GetEnabledModules()

		result := []map[string]interface{}{}
		for deviceType, metadata := range allModules {
			result = append(result, map[string]interface{}{
				"device_type":   deviceType,
				"device_name":   metadata.DeviceName,
				"description":   metadata.Description,
				"image_url":     metadata.ImageURL,
				"enabled":       enabledModules[deviceType],
				"event_types":   len(metadata.EventTypes),
				"common_fields": len(metadata.CommonFields),
			})
		}

		json.NewEncoder(w).Encode(result)
		return
	}

	if r.Method == "PUT" {
		// Update enabled modules
		var req struct {
			EnabledModules map[string]bool `json:"enabled_modules"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// Update registry
		registry.SetEnabledModules(req.EnabledModules)

		// Save to config
		if s.config.EnabledModules == nil {
			s.config.EnabledModules = make(map[string]bool)
		}
		for deviceType, enabled := range req.EnabledModules {
			s.config.EnabledModules[deviceType] = enabled
		}

		if err := SaveConfig("config.json", s.config); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":          "updated",
			"enabled_modules": req.EnabledModules,
		})
		return
	}

	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// Get module metadata for UI configuration
func (s *Server) handleModuleMetadataAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing module metadata
	if isSharedViewRequest(r) {
		http.Error(w, "module metadata access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	registry := modules.GetRegistry()

	// Check if specific device type requested
	deviceType := r.URL.Query().Get("device_type")
	if deviceType != "" {
		metadata := registry.GetModuleMetadata(deviceType)
		if metadata == nil {
			http.Error(w, "device type not found", http.StatusNotFound)
			return
		}
		json.NewEncoder(w).Encode(metadata)
		return
	}

	// Return all module metadata
	allMetadata := registry.GetAllModuleMetadata()
	json.NewEncoder(w).Encode(allMetadata)
}
