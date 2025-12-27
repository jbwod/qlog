package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"

	"qlog/modules"
)

// Log-related API handlers

func (s *Server) handleLogsAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Shared views can only GET (read-only)
	if isSharedViewRequest(r) && r.Method != "GET" {
		http.Error(w, "write operations not allowed in shared view mode", http.StatusForbidden)
		return
	}

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

	device := r.URL.Query().Get("device")
	deviceType := r.URL.Query().Get("device_type")
	eventType := r.URL.Query().Get("event_type")
	dateRange := r.URL.Query().Get("date_range")
	dateFrom := r.URL.Query().Get("date_from")
	dateTo := r.URL.Query().Get("date_to")
	search := r.URL.Query().Get("search")

	var logs []*LogEntry
	var err error
	if dateFrom != "" && dateTo != "" {
		logs, err = s.db.GetLogsWithCustomDate(limit, offset, severity, device, deviceType, eventType, dateRange, dateFrom, dateTo, search)
	} else {
		logs, err = s.db.GetLogs(limit, offset, severity, device, deviceType, eventType, dateRange, search)
	}
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
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Shared views can GET log details (read-only)
	if isSharedViewRequest(r) && r.Method != "GET" {
		http.Error(w, "write operations not allowed in shared view mode", http.StatusForbidden)
		return
	}

	pathParts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")
	if len(pathParts) < 3 {
		http.Error(w, "invalid log ID", http.StatusBadRequest)
		return
	}

	logIDStr := pathParts[2]
	logID, err := strconv.ParseInt(logIDStr, 10, 64)
	if err != nil {
		http.Error(w, "invalid log ID", http.StatusBadRequest)
		return
	}

	logEntry, err := s.db.GetLogByID(logID)
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
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Shared views can GET stats (read-only)
	if isSharedViewRequest(r) && r.Method != "GET" {
		http.Error(w, "write operations not allowed in shared view mode", http.StatusForbidden)
		return
	}

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
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Shared views can search (read-only)
	if isSharedViewRequest(r) && r.Method != "GET" {
		http.Error(w, "write operations not allowed in shared view mode", http.StatusForbidden)
		return
	}

	search := r.URL.Query().Get("q")
	if search == "" {
		http.Error(w, "search query required", http.StatusBadRequest)
		return
	}

	logs, err := s.db.GetLogs(100, 0, nil, "", "", "", "", search)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(logs)
}

func (s *Server) handleClearAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Block shared views from clearing logs
	if isSharedViewRequest(r) {
		http.Error(w, "clear logs not allowed in shared view mode", http.StatusForbidden)
		return
	}

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
