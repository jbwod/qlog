package main

import (
	"log"
	"strconv"
	"strings"
	"time"

	"qlog/modules"

	"github.com/leodido/go-syslog/v4/rfc3164"
	"github.com/leodido/go-syslog/v4/rfc5424"
)

// Message processing functions

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

func (s *Server) messageToEntry(message *rfc5424.SyslogMessage, remoteAddr, protocol, rfcFormat string) *LogEntry {
	entry := &LogEntry{
		Timestamp:      time.Now(),
		RemoteAddr:     remoteAddr,
		RawMessage:     "",
		StructuredData: make(map[string]map[string]string),
		ParsedFields:   make(map[string]interface{}),
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

	// Reconstruct raw message for device matching and parsing
	if message.Message != nil {
		entry.RawMessage = *message.Message
	} else {
		entry.RawMessage = ""
	}

	// Try to parse with device modules (but this will be overridden in saveLog if device IP matches)
	parsed := modules.GetRegistry().ParseLog(entry.RawMessage, entry.Timestamp, entry.Severity, entry.Priority)
	if parsed.DeviceType != "unknown" {
		entry.DeviceType = parsed.DeviceType
		entry.EventType = parsed.EventType
		entry.EventCategory = parsed.EventCategory
		entry.ParsedFields = parsed.Fields
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

	// Reconstruct raw message for device matching and parsing
	if message.Message != nil {
		entry.RawMessage = *message.Message
	} else {
		entry.RawMessage = ""
	}

	entry.ParsedFields = make(map[string]interface{})

	// Try to parse with device modules (but this will be overridden in saveLog if device IP matches)
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
	// Only accept messages from configured devices
	if s.config.Devices == nil || len(s.config.Devices) == 0 {
		// No devices configured - reject all messages
		log.Printf("Rejected message from %s: No devices configured", entry.RemoteAddr)
		return
	}

	if entry.RemoteAddr == "" {
		log.Printf("Warning: message has no remote address, skipping")
		return
	}

	// Extract IP from remote address (format: "ip:port")
	remoteIP := strings.Split(entry.RemoteAddr, ":")[0]

	// Find device that matches this IP and has an assigned listener
	var matchedDevice *DeviceConfig
	if s.config.Devices != nil {
		for i := range s.config.Devices {
			device := &s.config.Devices[i]
			// Check if device has an assigned listener and its IP matches
			if device.ListenerID != "" {
				for _, deviceIP := range device.IPAddresses {
					if deviceIP == remoteIP {
						matchedDevice = device
						break
					}
				}
			}
			if matchedDevice != nil {
				break
			}
		}
	}

	// If no device is configured, or no matching device with an assigned listener, reject the message
	if matchedDevice == nil {
		log.Printf("Rejected message from %s: No configured device with matching IP and active listener. Raw: %s", entry.RemoteAddr, entry.RawMessage[:min(len(entry.RawMessage), 100)])
		return // Do not save the log
	}

	// If device found, use its configured device type
	configuredDeviceType := matchedDevice.DeviceType
	entry.DeviceType = configuredDeviceType

	// Only re-parse with device modules if device type is "generic"
	// This allows generic devices to benefit from module parsing
	// but prevents modules from overriding configured device types
	if configuredDeviceType == "generic" {
		parsed := modules.GetRegistry().ParseLog(entry.RawMessage, entry.Timestamp, entry.Severity, entry.Priority)
		if parsed.DeviceType != "unknown" {
			entry.DeviceType = parsed.DeviceType
			entry.EventType = parsed.EventType
			entry.EventCategory = parsed.EventCategory
			entry.ParsedFields = parsed.Fields
		} else {
			// Keep as generic if no module detected it
			entry.DeviceType = "generic"
		}
	}
	// If device type is not "generic", keep the configured type and don't override with module parsing

	// Apply severity override if configured for this event type
	if entry.EventType != "" && s.config.SeverityOverrides != nil {
		if overrideSeverity, exists := s.config.SeverityOverrides[entry.EventType]; exists {
			entry.Severity = overrideSeverity
			// Recalculate priority: priority = facility * 8 + severity
			entry.Priority = entry.Facility*8 + overrideSeverity
		}
	}

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

