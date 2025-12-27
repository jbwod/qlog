package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	_ "github.com/mattn/go-sqlite3"
)

type Database struct {
	db *sql.DB
}

func NewDatabase(dbPath string) (*Database, error) {
	db, err := sql.Open("sqlite3", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	d := &Database{db: db}
	if err := d.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return d, nil
}

func (d *Database) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp DATETIME NOT NULL,
		priority INTEGER,
		facility INTEGER,
		severity INTEGER,
		version INTEGER,
		hostname TEXT,
		appname TEXT,
		procid TEXT,
		msgid TEXT,
		message TEXT,
		structured_data TEXT,
		raw_message TEXT,
		remote_addr TEXT,
		protocol TEXT,
		rfc_format TEXT,
		device_type TEXT,
		event_type TEXT,
		event_category TEXT,
		parsed_fields TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_timestamp ON logs(timestamp);
	CREATE INDEX IF NOT EXISTS idx_severity ON logs(severity);
	CREATE INDEX IF NOT EXISTS idx_hostname ON logs(hostname);
	CREATE INDEX IF NOT EXISTS idx_appname ON logs(appname);
	CREATE INDEX IF NOT EXISTS idx_created_at ON logs(created_at);

	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT UNIQUE NOT NULL,
		password_hash TEXT NOT NULL,
		role TEXT NOT NULL DEFAULT 'admin',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL,
		ip_address TEXT,
		expires_at DATETIME NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS login_attempts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT,
		ip_address TEXT,
		success INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
	CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
	CREATE INDEX IF NOT EXISTS idx_sessions_ip_address ON sessions(ip_address);
	CREATE INDEX IF NOT EXISTS idx_login_attempts_username ON login_attempts(username);
	CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address);
	CREATE INDEX IF NOT EXISTS idx_login_attempts_created ON login_attempts(created_at);
	`

	_, err := d.db.Exec(schema)
	return err
}

func (d *Database) InsertLog(entry *LogEntry, protocol, rfcFormat string) error {
	structuredDataJSON, _ := json.Marshal(entry.StructuredData)
	parsedFieldsJSON, _ := json.Marshal(entry.ParsedFields)

	query := `
	INSERT INTO logs (
		timestamp, priority, facility, severity, version,
		hostname, appname, procid, msgid, message,
		structured_data, raw_message, remote_addr, protocol, rfc_format,
		device_type, event_type, event_category, parsed_fields
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := d.db.Exec(query,
		entry.Timestamp,
		entry.Priority,
		entry.Facility,
		entry.Severity,
		entry.Version,
		entry.Hostname,
		entry.AppName,
		entry.ProcID,
		entry.MsgID,
		entry.Message,
		string(structuredDataJSON),
		entry.RawMessage,
		entry.RemoteAddr,
		protocol,
		rfcFormat,
		entry.DeviceType,
		entry.EventType,
		entry.EventCategory,
		string(parsedFieldsJSON),
	)

	return err
}

func (d *Database) GetLogs(limit, offset int, severity *uint8, device, deviceType, eventType, dateRange, search string) ([]*LogEntry, error) {
	return d.GetLogsWithCustomDate(limit, offset, severity, device, deviceType, eventType, dateRange, "", "", search)
}

func (d *Database) GetLogsWithCustomDate(limit, offset int, severity *uint8, device, deviceType, eventType, dateRange, dateFrom, dateTo, search string) ([]*LogEntry, error) {
	query := `
	SELECT id, timestamp, priority, facility, severity, version,
	       hostname, appname, procid, msgid, message,
	       structured_data, raw_message, remote_addr,
	       device_type, event_type, event_category, parsed_fields
	FROM logs
	WHERE 1=1
	`
	args := []interface{}{}

	// Date range filter - check for custom date range first
	if dateFrom != "" && dateTo != "" {
		query += " AND timestamp >= ? AND timestamp <= ?"
		args = append(args, dateFrom, dateTo)
	} else if dateRange != "" {
		switch dateRange {
		case "1h":
			query += " AND timestamp > datetime('now', '-1 hour')"
		case "24h":
			query += " AND timestamp > datetime('now', '-24 hours')"
		case "7d":
			query += " AND timestamp > datetime('now', '-7 days')"
		case "30d":
			query += " AND timestamp > datetime('now', '-30 days')"
		}
	}

	if severity != nil {
		query += " AND severity = ?"
		args = append(args, *severity)
	}
	if device != "" {
		// Search in hostname, remote_addr, or parsed_fields
		query += " AND (hostname LIKE ? OR remote_addr LIKE ? OR parsed_fields LIKE ?)"
		devicePattern := "%" + device + "%"
		args = append(args, devicePattern, devicePattern, devicePattern)
	}
	if deviceType != "" {
		query += " AND device_type = ?"
		args = append(args, deviceType)
	}
	if eventType != "" {
		query += " AND event_type = ?"
		args = append(args, eventType)
	}
	if search != "" {
		// Enhanced search: search across multiple fields including raw_message, hostname, message, and parsed_fields
		searchPattern := "%" + search + "%"
		query += ` AND (
			raw_message LIKE ? OR 
			message LIKE ? OR 
			hostname LIKE ? OR 
			appname LIKE ? OR
			device_type LIKE ? OR
			event_type LIKE ? OR
			event_category LIKE ? OR
			parsed_fields LIKE ?
		)`
		args = append(args, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern)
	}

	query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs := make([]*LogEntry, 0) // Initialize as empty slice, not nil
	for rows.Next() {
		var entry LogEntry
		var structuredDataJSON string
		var parsedFieldsJSON string

		err := rows.Scan(
			&entry.ID, &entry.Timestamp, &entry.Priority, &entry.Facility,
			&entry.Severity, &entry.Version, &entry.Hostname, &entry.AppName,
			&entry.ProcID, &entry.MsgID, &entry.Message, &structuredDataJSON,
			&entry.RawMessage, &entry.RemoteAddr,
			&entry.DeviceType, &entry.EventType, &entry.EventCategory, &parsedFieldsJSON,
		)
		if err != nil {
			continue
		}

		if structuredDataJSON != "" {
			json.Unmarshal([]byte(structuredDataJSON), &entry.StructuredData)
		}
		if entry.StructuredData == nil {
			entry.StructuredData = make(map[string]map[string]string)
		}

		if parsedFieldsJSON != "" {
			json.Unmarshal([]byte(parsedFieldsJSON), &entry.ParsedFields)
		}
		if entry.ParsedFields == nil {
			entry.ParsedFields = make(map[string]interface{})
		}

		logs = append(logs, &entry)
	}

	return logs, rows.Err()
}

func (d *Database) GetStats() (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	// Total count
	var total int
	err := d.db.QueryRow("SELECT COUNT(*) FROM logs").Scan(&total)
	if err != nil {
		return nil, err
	}
	stats["total"] = total

	// Count by severity
	rows, err := d.db.Query(`
		SELECT severity, COUNT(*) as count
		FROM logs
		GROUP BY severity
		ORDER BY severity
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	severityCount := make(map[string]int)
	for rows.Next() {
		var severity uint8
		var count int
		if err := rows.Scan(&severity, &count); err != nil {
			continue
		}
		severityNames := map[uint8]string{
			0: "Emergency", 1: "Alert", 2: "Critical", 3: "Error",
			4: "Warning", 5: "Notice", 6: "Informational", 7: "Debug",
		}
		severityCount[severityNames[severity]] = count
	}
	stats["by_severity"] = severityCount

	// Count by hostname (top 10)
	rows, err = d.db.Query(`
		SELECT hostname, COUNT(*) as count
		FROM logs
		WHERE hostname IS NOT NULL AND hostname != ''
		GROUP BY hostname
		ORDER BY count DESC
		LIMIT 10
	`)
	if err == nil {
		defer rows.Close()
		hostnameCount := make(map[string]int)
		for rows.Next() {
			var hostname string
			var count int
			if err := rows.Scan(&hostname, &count); err == nil {
				hostnameCount[hostname] = count
			}
		}
		stats["by_hostname"] = hostnameCount
	}

	// Count by protocol
	rows, err = d.db.Query(`
		SELECT protocol, COUNT(*) as count
		FROM logs
		WHERE protocol IS NOT NULL
		GROUP BY protocol
	`)
	if err == nil {
		defer rows.Close()
		protocolCount := make(map[string]int)
		for rows.Next() {
			var protocol string
			var count int
			if err := rows.Scan(&protocol, &count); err == nil {
				protocolCount[protocol] = count
			}
		}
		stats["by_protocol"] = protocolCount
	}

	// Recent activity (last hour)
	var recentCount int
	d.db.QueryRow(`
		SELECT COUNT(*) FROM logs
		WHERE timestamp > datetime('now', '-1 hour')
	`).Scan(&recentCount)
	stats["recent_hour"] = recentCount

	return stats, nil
}

func (d *Database) ClearLogs() error {
	_, err := d.db.Exec("DELETE FROM logs")
	return err
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) GetLogByID(id int64) (*LogEntry, error) {
	var entry LogEntry
	var structuredDataJSON string

	var parsedFieldsJSON string
	err := d.db.QueryRow(`
		SELECT id, timestamp, priority, facility, severity, version,
		       hostname, appname, procid, msgid, message,
		       structured_data, raw_message, remote_addr,
		       device_type, event_type, event_category, parsed_fields
		FROM logs
		WHERE id = ?
	`, id).Scan(
		&entry.ID, &entry.Timestamp, &entry.Priority, &entry.Facility,
		&entry.Severity, &entry.Version, &entry.Hostname, &entry.AppName,
		&entry.ProcID, &entry.MsgID, &entry.Message, &structuredDataJSON,
		&entry.RawMessage, &entry.RemoteAddr,
		&entry.DeviceType, &entry.EventType, &entry.EventCategory, &parsedFieldsJSON,
	)
	if err != nil {
		return nil, err
	}

	if structuredDataJSON != "" {
		json.Unmarshal([]byte(structuredDataJSON), &entry.StructuredData)
	}
	if entry.StructuredData == nil {
		entry.StructuredData = make(map[string]map[string]string)
	}

	if parsedFieldsJSON != "" {
		json.Unmarshal([]byte(parsedFieldsJSON), &entry.ParsedFields)
	}
	if entry.ParsedFields == nil {
		entry.ParsedFields = make(map[string]interface{})
	}

	return &entry, nil
}

func (d *Database) GetEventTypes() ([]string, error) {
	rows, err := d.db.Query("SELECT DISTINCT event_type FROM logs WHERE event_type IS NOT NULL AND event_type != '' AND event_type != 'unknown' ORDER BY event_type")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	eventTypes := []string{}
	for rows.Next() {
		var eventType string
		if err := rows.Scan(&eventType); err == nil {
			eventTypes = append(eventTypes, eventType)
		}
	}

	return eventTypes, nil
}

// QueryResult represents the result of a query/aggregation
type QueryResult struct {
	Columns []string                 `json:"columns"`
	Rows    []map[string]interface{} `json:"rows"`
	Meta    map[string]interface{}   `json:"meta,omitempty"`
}

// ExecuteQuery executes a custom query with aggregations
func (d *Database) ExecuteQuery(queryConfig map[string]interface{}) (*QueryResult, error) {
	// Extract query parameters
	selectField := getString(queryConfig, "select", "count(*)")
	fromTable := getString(queryConfig, "from", "logs")
	whereClause := getString(queryConfig, "where", "")
	groupBy := getString(queryConfig, "groupBy", "")
	orderBy := getString(queryConfig, "orderBy", "")
	limit := getInt(queryConfig, "limit", 100)
	timeRange := getString(queryConfig, "timeRange", "24h")

	// Build WHERE clause with time range
	timeFilter := d.buildTimeFilter(timeRange)
	if whereClause != "" {
		whereClause = "(" + whereClause + ") AND " + timeFilter
	} else {
		whereClause = timeFilter
	}

	// Build query
	query := "SELECT " + selectField
	if groupBy != "" {
		query += ", " + groupBy
	}
	query += " FROM " + fromTable
	if whereClause != "" {
		query += " WHERE " + whereClause
	}
	if groupBy != "" {
		query += " GROUP BY " + groupBy
	}
	if orderBy != "" {
		query += " ORDER BY " + orderBy
	}
	query += " LIMIT ?"

	args := []interface{}{limit}

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query execution failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	result := &QueryResult{
		Columns: columns,
		Rows:    []map[string]interface{}{},
	}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				val = string(b)
			}
			row[col] = val
		}
		result.Rows = append(result.Rows, row)
	}

	return result, rows.Err()
}

// GetAggregatedData performs common aggregations
func (d *Database) GetAggregatedData(aggregation map[string]interface{}) (*QueryResult, error) {
	field := getString(aggregation, "field", "event_type")
	operation := getString(aggregation, "operation", "count")
	groupBy := getString(aggregation, "groupBy", "")
	timeRange := getString(aggregation, "timeRange", "24h")
	filters := getMap(aggregation, "filters")
	topN := getInt(aggregation, "topN", 10)

	timeFilter := d.buildTimeFilter(timeRange)

	// Build WHERE clause
	whereParts := []string{timeFilter}
	if filters != nil {
		if deviceType := getString(filters, "device_type", ""); deviceType != "" {
			whereParts = append(whereParts, "device_type = '"+deviceType+"'")
		}
		if eventType := getString(filters, "event_type", ""); eventType != "" {
			whereParts = append(whereParts, "event_type = '"+eventType+"'")
		}
		if severity := getString(filters, "severity", ""); severity != "" {
			whereParts = append(whereParts, "severity = "+severity)
		}
		// Support filtering by JSON fields in parsed_fields
		if action := getString(filters, "action", ""); action != "" {
			whereParts = append(whereParts, "json_extract(parsed_fields, '$.action') = '"+action+"'")
		}
		if protocol := getString(filters, "protocol", ""); protocol != "" {
			whereParts = append(whereParts, "json_extract(parsed_fields, '$.protocol') = '"+protocol+"'")
		}
	}

	whereClause := "(" + whereParts[0]
	for i := 1; i < len(whereParts); i++ {
		whereClause += " AND " + whereParts[i]
	}
	whereClause += ")"

	// Build SELECT based on operation
	var selectExpr string
	switch operation {
	case "count":
		selectExpr = "COUNT(*) as count"
	case "sum":
		selectExpr = "SUM(" + field + ") as sum"
	case "avg":
		selectExpr = "AVG(" + field + ") as avg"
	case "max":
		selectExpr = "MAX(" + field + ") as max"
	case "min":
		selectExpr = "MIN(" + field + ") as min"
	default:
		selectExpr = "COUNT(*) as count"
	}

	// Handle JSON field extraction for groupBy
	var groupByExpr string
	if groupBy != "" {
		// Check if groupBy is a JSON field (starts with parsed_fields.)
		if strings.HasPrefix(groupBy, "parsed_fields.") {
			jsonPath := strings.TrimPrefix(groupBy, "parsed_fields.")
			groupByExpr = "json_extract(parsed_fields, '$." + jsonPath + "') as group_value"
		} else {
			groupByExpr = groupBy + " as group_value"
		}
	}

	query := "SELECT " + selectExpr
	if groupBy != "" {
		query += ", " + groupByExpr
		query += " FROM logs WHERE " + whereClause
		// Use the same expression for GROUP BY
		if strings.HasPrefix(groupBy, "parsed_fields.") {
			jsonPath := strings.TrimPrefix(groupBy, "parsed_fields.")
			query += " GROUP BY json_extract(parsed_fields, '$." + jsonPath + "')"
		} else {
			query += " GROUP BY " + groupBy
		}
		query += " ORDER BY count DESC"
	} else {
		query += " FROM logs WHERE " + whereClause
	}

	query += " LIMIT ?"

	rows, err := d.db.Query(query, topN)
	if err != nil {
		return nil, fmt.Errorf("aggregation failed: %w", err)
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	result := &QueryResult{
		Columns: columns,
		Rows:    []map[string]interface{}{},
	}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				val = string(b)
			}
			row[col] = val
		}
		result.Rows = append(result.Rows, row)
	}

	return result, rows.Err()
}

// GetTimeSeriesData gets time-series aggregated data
func (d *Database) GetTimeSeriesData(config map[string]interface{}) (*QueryResult, error) {
	field := getString(config, "field", "event_type")
	operation := getString(config, "operation", "count")
	timeInterval := getString(config, "interval", "1h") // 1h, 1d, etc.
	timeRange := getString(config, "timeRange", "24h")
	filters := getMap(config, "filters")
	groupBy := getString(config, "groupBy", "")

	timeFilter := d.buildTimeFilter(timeRange)

	// Build WHERE clause
	whereParts := []string{timeFilter}
	if filters != nil {
		if deviceType := getString(filters, "device_type", ""); deviceType != "" {
			whereParts = append(whereParts, "device_type = '"+deviceType+"'")
		}
		if eventType := getString(filters, "event_type", ""); eventType != "" {
			whereParts = append(whereParts, "event_type = '"+eventType+"'")
		}
	}

	whereClause := "(" + whereParts[0]
	for i := 1; i < len(whereParts); i++ {
		whereClause += " AND " + whereParts[i]
	}
	whereClause += ")"

	// Build time grouping
	var timeGroupExpr string
	switch timeInterval {
	case "1h":
		timeGroupExpr = "strftime('%Y-%m-%d %H:00:00', timestamp) as time_bucket"
	case "1d":
		timeGroupExpr = "date(timestamp) as time_bucket"
	default:
		timeGroupExpr = "strftime('%Y-%m-%d %H:00:00', timestamp) as time_bucket"
	}

	var selectExpr string
	switch operation {
	case "count":
		selectExpr = "COUNT(*) as value"
	case "sum":
		selectExpr = "SUM(" + field + ") as value"
	default:
		selectExpr = "COUNT(*) as value"
	}

	query := "SELECT " + timeGroupExpr + ", " + selectExpr
	if groupBy != "" {
		query += ", " + groupBy + " as series"
	}
	query += " FROM logs WHERE " + whereClause
	if groupBy != "" {
		query += " GROUP BY time_bucket, " + groupBy
	} else {
		query += " GROUP BY time_bucket"
	}
	query += " ORDER BY time_bucket"

	rows, err := d.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("time series query failed: %w", err)
	}
	defer rows.Close()

	columns, _ := rows.Columns()
	result := &QueryResult{
		Columns: columns,
		Rows:    []map[string]interface{}{},
	}

	for rows.Next() {
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))
		for i := range values {
			valuePtrs[i] = &values[i]
		}

		if err := rows.Scan(valuePtrs...); err != nil {
			continue
		}

		row := make(map[string]interface{})
		for i, col := range columns {
			val := values[i]
			if b, ok := val.([]byte); ok {
				val = string(b)
			}
			row[col] = val
		}
		result.Rows = append(result.Rows, row)
	}

	return result, rows.Err()
}

// Helper functions
func (d *Database) buildTimeFilter(timeRange string) string {
	switch timeRange {
	case "1h":
		return "timestamp > datetime('now', '-1 hour')"
	case "24h":
		return "timestamp > datetime('now', '-24 hours')"
	case "7d":
		return "timestamp > datetime('now', '-7 days')"
	case "30d":
		return "timestamp > datetime('now', '-30 days')"
	default:
		return "timestamp > datetime('now', '-24 hours')"
	}
}

func getString(m map[string]interface{}, key, defaultValue string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

func getInt(m map[string]interface{}, key string, defaultValue int) int {
	if val, ok := m[key]; ok {
		if num, ok := val.(float64); ok {
			return int(num)
		}
		if num, ok := val.(int); ok {
			return num
		}
	}
	return defaultValue
}

func getMap(m map[string]interface{}, key string) map[string]interface{} {
	if val, ok := m[key]; ok {
		if mp, ok := val.(map[string]interface{}); ok {
			return mp
		}
	}
	return nil
}

// Authentication functions

// HasAdmin checks if any admin user exists
func (d *Database) HasAdmin() (bool, error) {
	var count int
	err := d.db.QueryRow("SELECT COUNT(*) FROM users WHERE role = 'admin'").Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CreateUser creates a new user with hashed password
func (d *Database) CreateUser(username, passwordHash, role string) error {
	_, err := d.db.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		username, passwordHash, role,
	)
	return err
}

// GetUserByUsername retrieves a user by username
func (d *Database) GetUserByUsername(username string) (*User, error) {
	var user User
	err := d.db.QueryRow(
		"SELECT id, username, password_hash, role FROM users WHERE username = ?",
		username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByID retrieves a user by ID
func (d *Database) GetUserByID(userID int64) (*User, error) {
	var user User
	err := d.db.QueryRow(
		"SELECT id, username, password_hash, role FROM users WHERE id = ?",
		userID,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// CreateSession creates a new session (deprecated - use CreateSessionWithIP)
func (d *Database) CreateSession(sessionID string, userID int64, expiresAt string) error {
	return d.CreateSessionWithIP(sessionID, userID, "", expiresAt)
}

// CreateSessionWithIP creates a new session with IP address
func (d *Database) CreateSessionWithIP(sessionID string, userID int64, ipAddress string, expiresAt string) error {
	_, err := d.db.Exec(
		"INSERT INTO sessions (id, user_id, ip_address, expires_at) VALUES (?, ?, ?, ?)",
		sessionID, userID, ipAddress, expiresAt,
	)
	return err
}

// GetSession retrieves a session by ID
func (d *Database) GetSession(sessionID string) (*Session, error) {
	var session Session
	err := d.db.QueryRow(
		"SELECT id, user_id, COALESCE(ip_address, '') as ip_address, expires_at FROM sessions WHERE id = ? AND expires_at > datetime('now')",
		sessionID,
	).Scan(&session.ID, &session.UserID, &session.IPAddress, &session.ExpiresAt)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteUserSessions deletes all sessions for a user
func (d *Database) DeleteUserSessions(userID int64) error {
	_, err := d.db.Exec("DELETE FROM sessions WHERE user_id = ?", userID)
	return err
}

// LogLoginAttempt logs a login attempt
func (d *Database) LogLoginAttempt(username string, ipAddress string, success bool) error {
	successInt := 0
	if success {
		successInt = 1
	}
	_, err := d.db.Exec(
		"INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, ?)",
		username, ipAddress, successInt,
	)
	return err
}

// GetLoginAttempts retrieves recent login attempts
func (d *Database) GetLoginAttempts(limit int) ([]LoginAttempt, error) {
	rows, err := d.db.Query(
		"SELECT id, username, ip_address, success, created_at FROM login_attempts ORDER BY created_at DESC LIMIT ?",
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attempts []LoginAttempt
	for rows.Next() {
		var attempt LoginAttempt
		var successInt int
		if err := rows.Scan(&attempt.ID, &attempt.Username, &attempt.IPAddress, &successInt, &attempt.CreatedAt); err != nil {
			return nil, err
		}
		attempt.Success = successInt == 1
		attempts = append(attempts, attempt)
	}

	return attempts, rows.Err()
}

// DeleteSession deletes a session
func (d *Database) DeleteSession(sessionID string) error {
	_, err := d.db.Exec("DELETE FROM sessions WHERE id = ?", sessionID)
	return err
}

// CleanExpiredSessions removes expired sessions
func (d *Database) CleanExpiredSessions() error {
	_, err := d.db.Exec("DELETE FROM sessions WHERE expires_at <= datetime('now')")
	return err
}
