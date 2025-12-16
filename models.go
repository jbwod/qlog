package main

import "time"

type LogEntry struct {
	ID             int64                        `json:"id"`
	Timestamp      time.Time                    `json:"timestamp"`
	Priority       uint8                        `json:"priority"`
	Facility       uint8                        `json:"facility"`
	Severity       uint8                        `json:"severity"`
	Version        uint16                       `json:"version"`
	Hostname       string                       `json:"hostname"`
	AppName        string                       `json:"appname"`
	ProcID         string                       `json:"procid"`
	MsgID          string                       `json:"msgid"`
	Message        string                       `json:"message"`
	StructuredData map[string]map[string]string `json:"structured_data"`
	RawMessage     string                       `json:"raw_message"`
	RemoteAddr     string                       `json:"remote_addr"`
	DeviceType     string                       `json:"device_type"`
	EventType      string                       `json:"event_type"`
	EventCategory  string                       `json:"event_category"`
	ParsedFields   map[string]interface{}       `json:"parsed_fields"`
}

func (s *LogEntry) GetSeverityName() string {
	severityNames := map[uint8]string{
		0: "Emergency",
		1: "Alert",
		2: "Critical",
		3: "Error",
		4: "Warning",
		5: "Notice",
		6: "Informational",
		7: "Debug",
	}
	return severityNames[s.Severity]
}

func (s *LogEntry) GetSeverityColor() string {
	severityColors := map[uint8]string{
		0: "#ff0000", // Emergency - Red
		1: "#ff4500", // Alert - Orange Red
		2: "#ff6347", // Critical - Tomato
		3: "#ff8c00", // Error - Dark Orange
		4: "#ffa500", // Warning - Orange
		5: "#ffd700", // Notice - Gold
		6: "#32cd32", // Informational - Lime Green
		7: "#87ceeb", // Debug - Sky Blue
	}
	return severityColors[s.Severity]
}

