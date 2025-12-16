package modules

import (
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

// DeviceModule defines the interface for device-specific modules
type DeviceModule interface {
	// Detect checks if a log message matches this device type
	Detect(rawMessage string) bool
	
	// Parse extracts structured information from the log message
	Parse(rawMessage string, entry *ParsedLog) *ParsedLog
	
	// GetDeviceName returns the device name/type
	GetDeviceName() string
	
	// GetEventType returns the event type if detected
	GetEventType(rawMessage string) string
	
	// GetDisplayInfo returns UI display information
	GetDisplayInfo(entry *ParsedLog) *DisplayInfo
}

// ParsedLog contains parsed log information
type ParsedLog struct {
	DeviceType    string                 `json:"device_type"`
	EventType     string                 `json:"event_type"`
	EventCategory string                 `json:"event_category"`
	Fields        map[string]interface{} `json:"fields"`
	RawMessage    string                 `json:"raw_message"`
	Timestamp     time.Time              `json:"timestamp"`
	Severity      string                 `json:"severity"`
	Priority      int                    `json:"priority"`
}

// DisplayInfo contains UI display information
type DisplayInfo struct {
	Icon          string            `json:"icon"`
	Color         string            `json:"color"`
	Title         string            `json:"title"`
	Description   string            `json:"description"`
	Badges        []Badge           `json:"badges"`
	Details       []DetailItem      `json:"details"`
	Actions       []Action          `json:"actions"`
	Visualization string            `json:"visualization"` // chart, flow, timeline, etc.
	Metadata      map[string]string `json:"metadata"`
}

type Badge struct {
	Label string `json:"label"`
	Color string `json:"color"`
	Value string `json:"value"`
}

type DetailItem struct {
	Label string `json:"label"`
	Value string `json:"value"`
	Type  string `json:"type"` // text, ip, mac, url, signature, etc.
	Link  string `json:"link,omitempty"`
}

type Action struct {
	Label string `json:"label"`
	Type  string `json:"type"` // link, copy, view_rule, etc.
	URL   string `json:"url,omitempty"`
}

// ModuleRegistry manages device modules
type ModuleRegistry struct {
	modules []DeviceModule
}

var registry *ModuleRegistry

func init() {
	registry = &ModuleRegistry{
		modules: []DeviceModule{
			NewMerakiModule(),
			// Add more device modules here
		},
	}
}

func GetRegistry() *ModuleRegistry {
	return registry
}

func (r *ModuleRegistry) RegisterModule(module DeviceModule) {
	r.modules = append(r.modules, module)
}

func (r *ModuleRegistry) ParseLog(rawMessage string, timestamp time.Time, severity uint8, priority uint8) *ParsedLog {
	// Try each module to find a match
	for _, module := range r.modules {
		if module.Detect(rawMessage) {
			entry := &ParsedLog{
				RawMessage: rawMessage,
				Timestamp:  timestamp,
				Severity:   getSeverityName(severity),
				Priority:   int(priority),
			}
			return module.Parse(rawMessage, entry)
		}
	}
	
	// Default parsing if no module matches
	return &ParsedLog{
		DeviceType: "unknown",
		EventType: "unknown",
		Fields:    make(map[string]interface{}),
		RawMessage: rawMessage,
		Timestamp: timestamp,
		Severity:  getSeverityName(severity),
		Priority:  int(priority),
	}
}

func (r *ModuleRegistry) GetDisplayInfo(parsedLog *ParsedLog) *DisplayInfo {
	for _, module := range r.modules {
		if module.GetDeviceName() == parsedLog.DeviceType {
			return module.GetDisplayInfo(parsedLog)
		}
	}
	
	// Default display info
	return &DisplayInfo{
		Icon:  "📋",
		Color: "#9ca3af",
		Title: "Log Entry",
		Description: parsedLog.RawMessage,
	}
}

func getSeverityName(severity uint8) string {
	names := map[uint8]string{
		0: "Emergency", 1: "Alert", 2: "Critical", 3: "Error",
		4: "Warning", 5: "Notice", 6: "Informational", 7: "Debug",
	}
	return names[severity]
}

// Helper functions for parsing
func ExtractKeyValuePairs(text string) map[string]string {
	result := make(map[string]string)
	
	// Pattern for key=value pairs
	re := regexp.MustCompile(`(\w+)=([^\s]+|'[^']*'|"[^"]*")`)
	matches := re.FindAllStringSubmatch(text, -1)
	
	for _, match := range matches {
		if len(match) >= 3 {
			key := match[1]
			value := strings.Trim(match[2], `'"`)
			result[key] = value
		}
	}
	
	return result
}

func extractJSONFields(text string) map[string]interface{} {
	result := make(map[string]interface{})
	
	// Try to find JSON-like structures
	re := regexp.MustCompile(`\{[^}]+\}`)
	matches := re.FindAllString(text, -1)
	
	for _, match := range matches {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(match), &data); err == nil {
			for k, v := range data {
				result[k] = v
			}
		}
	}
	
	return result
}

