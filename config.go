package main

import (
	"encoding/json"
	"os"
)

type Config struct {
	Database struct {
		Path  string `json:"path"`
		Limit int    `json:"limit"` // 0 = unlimited
	} `json:"database"`
	Servers struct {
		UDP struct {
			Enabled bool `json:"enabled"`
			Port    int  `json:"port"`
		} `json:"udp"`
		TCP struct {
			Enabled bool `json:"enabled"`
			Port    int  `json:"port"`
		} `json:"tcp"`
		TLS struct {
			Enabled  bool   `json:"enabled"`
			Port     int    `json:"port"`
			CertFile string `json:"cert_file"`
			KeyFile  string `json:"key_file"`
		} `json:"tls"`
	} `json:"servers"`
	Web struct {
		Port int `json:"port"`
	} `json:"web"`
	Parsing struct {
		BestEffort     bool `json:"best_effort"`
		RFC3164Enabled bool `json:"rfc3164_enabled"`
		RFC5424Enabled bool `json:"rfc5424_enabled"`
	} `json:"parsing"`
	Listeners         []ListenerConfig     `json:"listeners,omitempty"`
	Devices           []DeviceConfig       `json:"devices,omitempty"`
	SeverityOverrides map[string]uint8     `json:"severity_overrides,omitempty"` // event_type -> severity (0-7)
	Views             []ViewConfig         `json:"views,omitempty"`
	Customization     *CustomizationConfig `json:"customization,omitempty"`
	EnabledModules    map[string]bool      `json:"enabled_modules,omitempty"` // device_type -> enabled
}

type CustomizationConfig struct {
	ColorScheme        string `json:"color_scheme,omitempty"`         // "default", "blue", "green", "purple", etc., "custom"
	PrimaryColor       string `json:"primary_color,omitempty"`        // Hex color for primary actions
	AccentColor        string `json:"accent_color,omitempty"`         // Hex color for accents
	AccentHover        string `json:"accent_hover,omitempty"`         // Hex color for accent hover state
	SuccessColor       string `json:"success_color,omitempty"`        // Hex color for success states
	WarningColor       string `json:"warning_color,omitempty"`        // Hex color for warnings
	ErrorColor         string `json:"error_color,omitempty"`          // Hex color for errors
	InfoColor          string `json:"info_color,omitempty"`           // Hex color for info
	BackgroundColor    string `json:"background_color,omitempty"`     // Hex color for main background
	NavColor           string `json:"nav_color,omitempty"`            // Hex color for navigation/sidebar
	BgTertiaryColor    string `json:"bg_tertiary_color,omitempty"`    // Hex color for tertiary background
	BgCardColor        string `json:"bg_card_color,omitempty"`        // Hex color for card background
	BgHoverColor       string `json:"bg_hover_color,omitempty"`       // Hex color for hover background
	TextColor          string `json:"text_color,omitempty"`           // Hex color for primary text
	TextSecondaryColor string `json:"text_secondary_color,omitempty"` // Hex color for secondary text
	TextTertiaryColor  string `json:"text_tertiary_color,omitempty"`  // Hex color for tertiary text
	LogoColor          string `json:"logo_color,omitempty"`           // Hex color for logo icon
	LogoTextColor      string `json:"logo_text_color,omitempty"`      // Hex color for logo text
	BrandName          string `json:"brand_name,omitempty"`           // Custom brand name
	BrandSubtitle      string `json:"brand_subtitle,omitempty"`       // Custom brand subtitle
	BrandLogo          string `json:"brand_logo,omitempty"`           // URL or path to logo
	Favicon            string `json:"favicon,omitempty"`              // URL or path to favicon
	ShowBranding       bool   `json:"show_branding,omitempty"`        // Show/hide branding
}

type ViewConfig struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Widgets     []WidgetConfig `json:"widgets"`
	Created     string         `json:"created"`
	Updated     string         `json:"updated"`
}

type WidgetConfig struct {
	ID     string                 `json:"id"`
	Type   string                 `json:"type"` // stat-card, chart-severity, chart-protocol, log-list, filter-panel, event-timeline
	Config map[string]interface{} `json:"config"`
}

type ListenerConfig struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Enabled     bool   `json:"enabled"`
	Protocol    string `json:"protocol"` // UDP, TCP, TLS
	Port        int    `json:"port"`
	Framing     string `json:"framing,omitempty"`      // "non-transparent" or "octet-counting" (for TCP/TLS)
	Parser      string `json:"parser"`                 // "RFC5424" or "RFC3164"
	CertFile    string `json:"cert_file,omitempty"`    // Path to uploaded certificate
	KeyFile     string `json:"key_file,omitempty"`     // Path to uploaded private key
	CaCertFile  string `json:"ca_cert_file,omitempty"` // Path to CA certificate for client validation (RFC 5425)
	Description string `json:"description,omitempty"`
}

type DeviceConfig struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	DeviceType  string   `json:"device_type"`  // e.g., "meraki", "generic"
	ListenerID  string   `json:"listener_id"`  // Which listener this device uses
	IPAddresses []string `json:"ip_addresses"` // IP addresses to filter messages from
	Description string   `json:"description,omitempty"`
}

func LoadConfig(path string) (*Config, error) {
	config := &Config{}

	// Set defaults
	config.Database.Path = "qlog.db"
	config.Servers.UDP.Enabled = true
	config.Servers.UDP.Port = 514
	config.Servers.TCP.Enabled = true
	config.Servers.TCP.Port = 514
	config.Servers.TLS.Enabled = false
	config.Servers.TLS.Port = 6514
	config.Web.Port = 8080
	config.Parsing.BestEffort = true
	config.Parsing.RFC3164Enabled = true
	config.Parsing.RFC5424Enabled = true

	if path != "" {
		data, err := os.ReadFile(path)
		if err != nil {
			if os.IsNotExist(err) {
				// Create default config file
				if err := SaveConfig(path, config); err != nil {
					return config, nil
				}
				return config, nil
			}
			return nil, err
		}

		if err := json.Unmarshal(data, config); err != nil {
			return nil, err
		}
	}

	return config, nil
}

func SaveConfig(path string, config *Config) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}
