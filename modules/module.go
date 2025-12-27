package modules

import (
	"encoding/json"
	"fmt"
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

	// GetMetadata returns metadata about this device module for UI configuration
	GetMetadata() *ModuleMetadata
}

// ModuleMetadata provides information about a device module for dynamic UI configuration
type ModuleMetadata struct {
	DeviceType        string             `json:"device_type"`
	DeviceName        string             `json:"device_name"`
	Description       string             `json:"description"`
	ImageURL          string             `json:"image_url,omitempty"` // Logo/image URL for the module
	EventTypes        []EventTypeInfo    `json:"event_types"`
	CommonFields      []FieldInfo        `json:"common_fields"`
	FilterSuggestions []FilterSuggestion `json:"filter_suggestions"`
	WidgetHints       []WidgetHint       `json:"widget_hints"`
}

// EventTypeInfo describes an event type
type EventTypeInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
}

// FieldInfo describes a common field in parsed_fields
type FieldInfo struct {
	Key         string   `json:"key"`
	Label       string   `json:"label"`
	Description string   `json:"description"`
	Type        string   `json:"type"` // ip, mac, port, string, number, url, etc.
	Examples    []string `json:"examples,omitempty"`
}

// FilterSuggestion provides filter configuration suggestions
type FilterSuggestion struct {
	Field       string   `json:"field"`
	Label       string   `json:"label"`
	Type        string   `json:"type"` // select, text, number, date, etc.
	Options     []string `json:"options,omitempty"`
	Description string   `json:"description"`
}

// WidgetHint suggests widget configurations for this device type
type WidgetHint struct {
	WidgetType  string                 `json:"widget_type"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
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
	modules        []DeviceModule
	enabledModules map[string]bool // device_type -> enabled
}

var registry *ModuleRegistry

func init() {
	registry = &ModuleRegistry{
		modules: []DeviceModule{
			NewUbiquitiModule(), // Check Ubiquiti first (more specific CEF detection)
			NewCiscoModule(),    // Check Cisco before Meraki (Cisco format is very specific)
			NewMerakiModule(),
			// Add more device modules here
		},
		enabledModules: make(map[string]bool),
	}
	// Enable all modules by default
	for _, module := range registry.modules {
		registry.enabledModules[module.GetDeviceName()] = true
	}
}

// SetModuleEnabled enables or disables a module
func (r *ModuleRegistry) SetModuleEnabled(deviceType string, enabled bool) {
	r.enabledModules[deviceType] = enabled
}

// IsModuleEnabled checks if a module is enabled
func (r *ModuleRegistry) IsModuleEnabled(deviceType string) bool {
	if enabled, ok := r.enabledModules[deviceType]; ok {
		return enabled
	}
	return true // Default to enabled if not specified
}

// GetEnabledModules returns a map of enabled modules
func (r *ModuleRegistry) GetEnabledModules() map[string]bool {
	result := make(map[string]bool)
	for _, module := range r.modules {
		result[module.GetDeviceName()] = r.IsModuleEnabled(module.GetDeviceName())
	}
	return result
}

// SetEnabledModules sets the enabled state for multiple modules
func (r *ModuleRegistry) SetEnabledModules(enabled map[string]bool) {
	for deviceType, enabledState := range enabled {
		r.enabledModules[deviceType] = enabledState
	}
}

func GetRegistry() *ModuleRegistry {
	return registry
}

func (r *ModuleRegistry) RegisterModule(module DeviceModule) {
	r.modules = append(r.modules, module)
}

func (r *ModuleRegistry) GetDeviceTypes() []map[string]string {
	deviceTypes := []map[string]string{}
	for _, module := range r.modules {
		name := module.GetDeviceName()
		// Capitalize first letter
		if len(name) > 0 {
			name = strings.ToUpper(string(name[0])) + name[1:]
		}
		deviceTypes = append(deviceTypes, map[string]string{
			"id":      module.GetDeviceName(),
			"name":    name,
			"enabled": fmt.Sprintf("%v", r.IsModuleEnabled(module.GetDeviceName())),
		})
	}
	return deviceTypes
}

func (r *ModuleRegistry) ParseLog(rawMessage string, timestamp time.Time, severity uint8, priority uint8) *ParsedLog {
	// Try each module to find a match (only if enabled)
	for _, module := range r.modules {
		if r.IsModuleEnabled(module.GetDeviceName()) && module.Detect(rawMessage) {
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
		EventType:  "unknown",
		Fields:     make(map[string]interface{}),
		RawMessage: rawMessage,
		Timestamp:  timestamp,
		Severity:   getSeverityName(severity),
		Priority:   int(priority),
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
		Icon:        "📋",
		Color:       "#9ca3af",
		Title:       "Log Entry",
		Description: parsedLog.RawMessage,
	}
}

// GetModuleMetadata returns metadata for a specific device type
func (r *ModuleRegistry) GetModuleMetadata(deviceType string) *ModuleMetadata {
	for _, module := range r.modules {
		if module.GetDeviceName() == deviceType {
			return module.GetMetadata()
		}
	}
	return nil
}

// GetAllModuleMetadata returns metadata for all registered modules
func (r *ModuleRegistry) GetAllModuleMetadata() map[string]*ModuleMetadata {
	result := make(map[string]*ModuleMetadata)
	for _, module := range r.modules {
		metadata := module.GetMetadata()
		if metadata != nil {
			result[module.GetDeviceName()] = metadata
		}
	}
	return result
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
