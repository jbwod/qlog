package main

import (
	"encoding/json"
	"net"
	"net/http"
)

// Query, aggregation, and server info API handlers

func (s *Server) handleQueryAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Shared views can execute queries (read-only queries are safe)
	// No additional restrictions needed as queries are read-only by design

	var queryConfig map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&queryConfig); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.db.ExecuteQuery(queryConfig)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleAggregateAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from aggregate queries (read-only queries only)
	if isSharedViewRequest(r) {
		http.Error(w, "aggregate queries not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var aggregation map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&aggregation); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.db.GetAggregatedData(aggregation)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleTimeSeriesAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from time series queries (read-only queries only)
	if isSharedViewRequest(r) {
		http.Error(w, "time series queries not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var config map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&config); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, err := s.db.GetTimeSeriesData(config)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleServerInfoAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from accessing server info
	if isSharedViewRequest(r) {
		http.Error(w, "server info access not allowed in shared view mode", http.StatusForbidden)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get server IP addresses
	addrs, _ := net.InterfaceAddrs()
	ipAddresses := []string{}
	for _, addr := range addrs {
		if ipNet, ok := addr.(*net.IPNet); ok && !ipNet.IP.IsLoopback() {
			if ipNet.IP.To4() != nil {
				ipAddresses = append(ipAddresses, ipNet.IP.String())
			}
		}
	}

	// Get active listeners
	s.listenerMu.RLock()
	activeListeners := []map[string]interface{}{}
	for id, control := range s.activeListeners {
		// Find listener config
		var listenerConfig *ListenerConfig
		if s.config.Listeners != nil {
			for i := range s.config.Listeners {
				if s.config.Listeners[i].ID == id {
					listenerConfig = &s.config.Listeners[i]
					break
				}
			}
		}
		if listenerConfig != nil {
			activeListeners = append(activeListeners, map[string]interface{}{
				"id":       id,
				"name":     listenerConfig.Name,
				"protocol": listenerConfig.Protocol,
				"port":     listenerConfig.Port,
				"type":     control.Type,
			})
		}
	}
	s.listenerMu.RUnlock()

	// Get device summary
	deviceSummary := map[string]interface{}{
		"total":   0,
		"enabled": 0,
		"by_type": make(map[string]int),
	}
	if s.config.Devices != nil {
		deviceSummary["total"] = len(s.config.Devices)
		enabledCount := 0
		for _, device := range s.config.Devices {
			// Check if device has a listener assigned (considered enabled)
			if device.ListenerID != "" {
				enabledCount++
			}
			deviceType := device.DeviceType
			if deviceType == "" {
				deviceType = "generic"
			}
			deviceSummary["by_type"].(map[string]int)[deviceType]++
		}
		deviceSummary["enabled"] = enabledCount
	}

	// Get listener summary
	listenerSummary := map[string]interface{}{
		"total":       0,
		"enabled":     0,
		"by_protocol": make(map[string]int),
	}
	if s.config.Listeners != nil {
		listenerSummary["total"] = len(s.config.Listeners)
		for _, listener := range s.config.Listeners {
			if listener.Enabled {
				listenerSummary["enabled"] = listenerSummary["enabled"].(int) + 1
			}
			listenerSummary["by_protocol"].(map[string]int)[listener.Protocol]++
		}
	}

	info := map[string]interface{}{
		"ip_addresses":     ipAddresses,
		"web_port":         s.config.Web.Port,
		"database_path":    s.config.Database.Path,
		"message_limit":    s.config.Database.Limit,
		"active_listeners": activeListeners,
		"device_summary":   deviceSummary,
		"listener_summary": listenerSummary,
	}

	json.NewEncoder(w).Encode(info)
}
