package main

import (
	"database/sql"
	"encoding/json"
	"fmt"

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

func (d *Database) GetLogs(limit, offset int, severity *uint8, hostname, appname, search string) ([]*LogEntry, error) {
	query := `
	SELECT id, timestamp, priority, facility, severity, version,
	       hostname, appname, procid, msgid, message,
	       structured_data, raw_message, remote_addr,
	       device_type, event_type, event_category, parsed_fields
	FROM logs
	WHERE 1=1
	`
	args := []interface{}{}

	if severity != nil {
		query += " AND severity = ?"
		args = append(args, *severity)
	}
	if hostname != "" {
		query += " AND hostname LIKE ?"
		args = append(args, "%"+hostname+"%")
	}
	if appname != "" {
		query += " AND appname LIKE ?"
		args = append(args, "%"+appname+"%")
	}
	if search != "" {
		query += " AND (message LIKE ? OR raw_message LIKE ? OR hostname LIKE ? OR appname LIKE ?)"
		searchPattern := "%" + search + "%"
		args = append(args, searchPattern, searchPattern, searchPattern, searchPattern)
	}

	query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := d.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*LogEntry
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

