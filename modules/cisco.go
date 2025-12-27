package modules

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type CiscoModule struct{}

func NewCiscoModule() *CiscoModule {
	return &CiscoModule{}
}

func (c *CiscoModule) GetDeviceName() string {
	return "cisco"
}

func (c *CiscoModule) Detect(rawMessage string) bool {
	// Cisco IOS messages have a distinctive format: %FACILITY-SEVERITY-MNEMONIC:description
	// This is the most reliable detection method
	ciscoPattern := regexp.MustCompile(`%[A-Z0-9_]+-\d+-[A-Z0-9_]+:`)
	if ciscoPattern.MatchString(rawMessage) {
		return true
	}

	// Secondary detection: look for common Cisco hostname patterns
	lowerMsg := strings.ToLower(rawMessage)
	ciscoHostnamePatterns := []string{
		"cisco", "router", "switch", "asa", "nexus", "catalyst",
		"ios", "ios-xe", "ios-xr", "nx-os",
	}

	for _, pattern := range ciscoHostnamePatterns {
		if strings.Contains(lowerMsg, pattern) {
			// Additional check: look for Cisco-specific keywords
			ciscoKeywords := []string{
				"interface", "line protocol", "changed state",
				"configured from", "vty", "console",
				"neighbor", "adjacency", "ospf", "bgp", "eigrp",
			}
			for _, keyword := range ciscoKeywords {
				if strings.Contains(lowerMsg, keyword) {
					return true
				}
			}
		}
	}

	return false
}

func (c *CiscoModule) GetEventType(rawMessage string) string {
	// Parse Cisco IOS format: %FACILITY-SEVERITY-MNEMONIC:description
	ciscoMsgPattern := regexp.MustCompile(`%([A-Z0-9_]+)-(\d+)-([A-Z0-9_]+):`)
	matches := ciscoMsgPattern.FindStringSubmatch(rawMessage)

	if len(matches) >= 4 {
		facility := strings.ToLower(matches[1])
		_ = matches[2] // severity - not used in event type determination
		mnemonic := strings.ToLower(matches[3])

		// Build event type from facility and mnemonic
		eventType := fmt.Sprintf("%s_%s", facility, mnemonic)

		// Map common facilities and mnemonics to normalized event types
		switch facility {
		case "link":
			if strings.Contains(rawMessage, "changed state to up") {
				return "interface_up"
			} else if strings.Contains(rawMessage, "changed state to down") {
				return "interface_down"
			}
			return "interface_state_change"

		case "lineproto":
			if strings.Contains(rawMessage, "changed state to up") {
				return "line_protocol_up"
			} else if strings.Contains(rawMessage, "changed state to down") {
				return "line_protocol_down"
			}
			return "line_protocol_state_change"

		case "sys":
			if mnemonic == "config_i" || mnemonic == "config" {
				return "configuration_change"
			} else if mnemonic == "restart" {
				return "system_restart"
			} else if mnemonic == "reload" {
				return "system_reload"
			}
			return "system_event"

		case "ospf":
			if strings.Contains(rawMessage, "neighbor") {
				if strings.Contains(rawMessage, "up") || strings.Contains(rawMessage, "full") {
					return "ospf_neighbor_up"
				} else if strings.Contains(rawMessage, "down") {
					return "ospf_neighbor_down"
				}
				return "ospf_neighbor_change"
			} else if strings.Contains(rawMessage, "adjacency") {
				return "ospf_adjacency_change"
			}
			return "ospf_event"

		case "bgp":
			if strings.Contains(rawMessage, "neighbor") {
				if strings.Contains(rawMessage, "up") || strings.Contains(rawMessage, "established") {
					return "bgp_neighbor_up"
				} else if strings.Contains(rawMessage, "down") {
					return "bgp_neighbor_down"
				}
				return "bgp_neighbor_change"
			}
			return "bgp_event"

		case "eigrp":
			if strings.Contains(rawMessage, "neighbor") {
				return "eigrp_neighbor_change"
			}
			return "eigrp_event"

		case "sec_login":
			if strings.Contains(rawMessage, "success") || strings.Contains(rawMessage, "login success") {
				return "login_success"
			} else if strings.Contains(rawMessage, "failure") || strings.Contains(rawMessage, "login failed") {
				return "login_failure"
			} else if strings.Contains(rawMessage, "logout") {
				return "logout"
			}
			return "authentication_event"

		case "auth":
			if strings.Contains(rawMessage, "success") {
				return "authentication_success"
			} else if strings.Contains(rawMessage, "failure") || strings.Contains(rawMessage, "failed") {
				return "authentication_failure"
			}
			return "authentication_event"

		case "acl":
			if strings.Contains(rawMessage, "denied") || strings.Contains(rawMessage, "blocked") {
				return "acl_denied"
			} else if strings.Contains(rawMessage, "permitted") || strings.Contains(rawMessage, "allowed") {
				return "acl_permitted"
			}
			return "acl_event"

		case "ip":
			if strings.Contains(rawMessage, "duplicate") {
				return "ip_duplicate"
			} else if strings.Contains(rawMessage, "conflict") {
				return "ip_conflict"
			}
			return "ip_event"

		case "dhcp":
			if strings.Contains(rawMessage, "lease") {
				return "dhcp_lease"
			} else if strings.Contains(rawMessage, "release") {
				return "dhcp_release"
			}
			return "dhcp_event"

		case "hsrp":
			if strings.Contains(rawMessage, "standby") {
				if strings.Contains(rawMessage, "active") {
					return "hsrp_active"
				} else if strings.Contains(rawMessage, "standby") {
					return "hsrp_standby"
				}
				return "hsrp_state_change"
			}
			return "hsrp_event"

		case "vrrp":
			if strings.Contains(rawMessage, "master") {
				return "vrrp_master"
			} else if strings.Contains(rawMessage, "backup") {
				return "vrrp_backup"
			}
			return "vrrp_state_change"

		case "stp":
			if strings.Contains(rawMessage, "topology change") {
				return "stp_topology_change"
			} else if strings.Contains(rawMessage, "port") {
				return "stp_port_change"
			}
			return "stp_event"

		case "snmp":
			return "snmp_event"

		case "tcp":
			return "tcp_event"

		case "udp":
			return "udp_event"

		case "ipsec":
			if strings.Contains(rawMessage, "established") {
				return "ipsec_tunnel_up"
			} else if strings.Contains(rawMessage, "torn down") || strings.Contains(rawMessage, "down") {
				return "ipsec_tunnel_down"
			}
			return "ipsec_event"

		case "crypto":
			if strings.Contains(rawMessage, "ike") {
				return "ike_event"
			} else if strings.Contains(rawMessage, "ipsec") {
				return "ipsec_event"
			}
			return "crypto_event"

		default:
			// Return normalized event type
			return eventType
		}
	}

	return "unknown"
}

func (c *CiscoModule) Parse(rawMessage string, entry *ParsedLog) *ParsedLog {
	entry.DeviceType = "cisco"
	entry.EventType = c.GetEventType(rawMessage)
	entry.Fields = make(map[string]interface{})

	// Parse Cisco IOS format: %FACILITY-SEVERITY-MNEMONIC:description
	ciscoMsgPattern := regexp.MustCompile(`%([A-Z0-9_]+)-(\d+)-([A-Z0-9_]+):\s*(.*)`)
	matches := ciscoMsgPattern.FindStringSubmatch(rawMessage)

	if len(matches) >= 5 {
		entry.Fields["facility"] = matches[1]
		if severity, err := strconv.Atoi(matches[2]); err == nil {
			entry.Fields["severity"] = severity
		}
		entry.Fields["mnemonic"] = matches[3]
		description := matches[4]
		entry.Fields["description"] = description

		// Extract interface name
		if match := regexp.MustCompile(`Interface\s+([A-Za-z0-9/.\-]+)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["interface"] = match[1]
		} else if match := regexp.MustCompile(`interface\s+([A-Za-z0-9/.\-]+)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["interface"] = match[1]
		}

		// Extract IP addresses
		ipPattern := regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)
		ips := ipPattern.FindAllString(description, -1)
		if len(ips) > 0 {
			entry.Fields["source_ip"] = ips[0]
			if len(ips) > 1 {
				entry.Fields["dest_ip"] = ips[1]
			}
		}

		// Extract neighbor IP (for routing protocols)
		if match := regexp.MustCompile(`neighbor\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["neighbor_ip"] = match[1]
		} else if match := regexp.MustCompile(`Neighbor\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["neighbor_ip"] = match[1]
		}

		// Extract user information
		if match := regexp.MustCompile(`user:\s*(\w+)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["user"] = match[1]
		} else if match := regexp.MustCompile(`\[user:\s*(\w+)\]`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["user"] = match[1]
		} else if match := regexp.MustCompile(`by\s+(\w+)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["user"] = match[1]
		}

		// Extract source IP from configuration changes
		if match := regexp.MustCompile(`\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["source_ip"] = match[1]
		}

		// Extract vty/console information
		if match := regexp.MustCompile(`(vty\d+|console|aux)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["line"] = match[1]
		}

		// Extract state information
		if strings.Contains(description, "changed state to up") {
			entry.Fields["state"] = "up"
		} else if strings.Contains(description, "changed state to down") {
			entry.Fields["state"] = "down"
		} else if strings.Contains(description, "changed state") {
			if match := regexp.MustCompile(`changed state to\s+(\w+)`).FindStringSubmatch(description); len(match) > 1 {
				entry.Fields["state"] = strings.ToLower(match[1])
			}
		}

		// Extract protocol information (OSPF, BGP, etc.)
		if strings.Contains(description, "OSPF") {
			entry.Fields["protocol"] = "OSPF"
		} else if strings.Contains(description, "BGP") {
			entry.Fields["protocol"] = "BGP"
		} else if strings.Contains(description, "EIGRP") {
			entry.Fields["protocol"] = "EIGRP"
		}

		// Extract ACL information
		if match := regexp.MustCompile(`access-list\s+(\w+)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["acl_name"] = match[1]
		} else if match := regexp.MustCompile(`ACL\s+(\w+)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["acl_name"] = match[1]
		}

		// Extract port information
		if match := regexp.MustCompile(`port\s+(\d+)`).FindStringSubmatch(description); len(match) > 1 {
			if port, err := strconv.Atoi(match[1]); err == nil {
				entry.Fields["port"] = port
			}
		}

		// Extract VLAN information
		if match := regexp.MustCompile(`Vlan(\d+)`).FindStringSubmatch(description); len(match) > 1 {
			if vlan, err := strconv.Atoi(match[1]); err == nil {
				entry.Fields["vlan"] = vlan
			}
		}

		// Extract HSRP/VRRP group
		if match := regexp.MustCompile(`group\s+(\d+)`).FindStringSubmatch(description); len(match) > 1 {
			if group, err := strconv.Atoi(match[1]); err == nil {
				entry.Fields["group"] = group
			}
		}

		// Extract reason/cause
		if match := regexp.MustCompile(`reason:\s*(.+?)(?:\s|$)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["reason"] = strings.TrimSpace(match[1])
		} else if match := regexp.MustCompile(`due to\s+(.+?)(?:\s|$)`).FindStringSubmatch(description); len(match) > 1 {
			entry.Fields["reason"] = strings.TrimSpace(match[1])
		}
	}

	// Set event category based on facility
	if facility, ok := entry.Fields["facility"].(string); ok {
		entry.EventCategory = c.inferCategory(facility, entry.EventType)
	} else {
		entry.EventCategory = "System"
	}

	return entry
}

func (c *CiscoModule) inferCategory(facility, eventType string) string {
	facilityLower := strings.ToLower(facility)
	eventTypeLower := strings.ToLower(eventType)

	// Security-related
	if facilityLower == "sec_login" || facilityLower == "auth" ||
		strings.Contains(eventTypeLower, "login") ||
		strings.Contains(eventTypeLower, "auth") {
		return "Security"
	}

	// Network/Interface related
	if facilityLower == "link" || facilityLower == "lineproto" ||
		strings.Contains(eventTypeLower, "interface") ||
		strings.Contains(eventTypeLower, "line_protocol") {
		return "Network"
	}

	// Routing protocols
	if facilityLower == "ospf" || facilityLower == "bgp" || facilityLower == "eigrp" ||
		strings.Contains(eventTypeLower, "ospf") ||
		strings.Contains(eventTypeLower, "bgp") ||
		strings.Contains(eventTypeLower, "eigrp") ||
		strings.Contains(eventTypeLower, "neighbor") {
		return "Routing"
	}

	// System/Configuration
	if facilityLower == "sys" || strings.Contains(eventTypeLower, "config") ||
		strings.Contains(eventTypeLower, "system") {
		return "System"
	}

	// ACL/Firewall
	if facilityLower == "acl" || strings.Contains(eventTypeLower, "acl") {
		return "Security"
	}

	// IP/DHCP
	if facilityLower == "ip" || facilityLower == "dhcp" {
		return "Network"
	}

	// Redundancy protocols
	if facilityLower == "hsrp" || facilityLower == "vrrp" || facilityLower == "glbp" {
		return "Network"
	}

	// VPN/Crypto
	if facilityLower == "ipsec" || facilityLower == "crypto" ||
		strings.Contains(eventTypeLower, "ipsec") ||
		strings.Contains(eventTypeLower, "ike") {
		return "VPN"
	}

	// STP
	if facilityLower == "stp" || strings.Contains(eventTypeLower, "stp") {
		return "Network"
	}

	return "System"
}

func (c *CiscoModule) GetMetadata() *ModuleMetadata {
	return &ModuleMetadata{
		DeviceType:  "cisco",
		DeviceName:  "Cisco IOS",
		Description: "Cisco IOS/IOS-XE devices (routers, switches)",
		ImageURL:    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSQOAChgbcID6GCQOaRFeQy3OmHRXNZjVYOug&s",
		EventTypes: []EventTypeInfo{
			// Interface Events
			{ID: "interface_up", Name: "Interface Up", Description: "Interface changed state to up", Category: "Network"},
			{ID: "interface_down", Name: "Interface Down", Description: "Interface changed state to down", Category: "Network"},
			{ID: "interface_state_change", Name: "Interface State Change", Description: "Interface state changed", Category: "Network"},
			{ID: "line_protocol_up", Name: "Line Protocol Up", Description: "Line protocol changed state to up", Category: "Network"},
			{ID: "line_protocol_down", Name: "Line Protocol Down", Description: "Line protocol changed state to down", Category: "Network"},
			{ID: "line_protocol_state_change", Name: "Line Protocol State Change", Description: "Line protocol state changed", Category: "Network"},

			// System Events
			{ID: "configuration_change", Name: "Configuration Change", Description: "Device configuration was changed", Category: "System"},
			{ID: "system_restart", Name: "System Restart", Description: "System restarted", Category: "System"},
			{ID: "system_reload", Name: "System Reload", Description: "System reloaded", Category: "System"},
			{ID: "system_event", Name: "System Event", Description: "System event occurred", Category: "System"},

			// Routing Protocol Events
			{ID: "ospf_neighbor_up", Name: "OSPF Neighbor Up", Description: "OSPF neighbor came up", Category: "Routing"},
			{ID: "ospf_neighbor_down", Name: "OSPF Neighbor Down", Description: "OSPF neighbor went down", Category: "Routing"},
			{ID: "ospf_neighbor_change", Name: "OSPF Neighbor Change", Description: "OSPF neighbor state changed", Category: "Routing"},
			{ID: "ospf_adjacency_change", Name: "OSPF Adjacency Change", Description: "OSPF adjacency changed", Category: "Routing"},
			{ID: "ospf_event", Name: "OSPF Event", Description: "OSPF protocol event", Category: "Routing"},
			{ID: "bgp_neighbor_up", Name: "BGP Neighbor Up", Description: "BGP neighbor came up", Category: "Routing"},
			{ID: "bgp_neighbor_down", Name: "BGP Neighbor Down", Description: "BGP neighbor went down", Category: "Routing"},
			{ID: "bgp_neighbor_change", Name: "BGP Neighbor Change", Description: "BGP neighbor state changed", Category: "Routing"},
			{ID: "bgp_event", Name: "BGP Event", Description: "BGP protocol event", Category: "Routing"},
			{ID: "eigrp_neighbor_change", Name: "EIGRP Neighbor Change", Description: "EIGRP neighbor state changed", Category: "Routing"},
			{ID: "eigrp_event", Name: "EIGRP Event", Description: "EIGRP protocol event", Category: "Routing"},

			// Security Events
			{ID: "login_success", Name: "Login Success", Description: "Successful login", Category: "Security"},
			{ID: "login_failure", Name: "Login Failure", Description: "Failed login attempt", Category: "Security"},
			{ID: "logout", Name: "Logout", Description: "User logged out", Category: "Security"},
			{ID: "authentication_success", Name: "Authentication Success", Description: "Authentication successful", Category: "Security"},
			{ID: "authentication_failure", Name: "Authentication Failure", Description: "Authentication failed", Category: "Security"},
			{ID: "authentication_event", Name: "Authentication Event", Description: "Authentication event", Category: "Security"},
			{ID: "acl_denied", Name: "ACL Denied", Description: "Traffic denied by ACL", Category: "Security"},
			{ID: "acl_permitted", Name: "ACL Permitted", Description: "Traffic permitted by ACL", Category: "Security"},
			{ID: "acl_event", Name: "ACL Event", Description: "ACL event", Category: "Security"},

			// Network Events
			{ID: "ip_duplicate", Name: "IP Duplicate", Description: "Duplicate IP address detected", Category: "Network"},
			{ID: "ip_conflict", Name: "IP Conflict", Description: "IP address conflict detected", Category: "Network"},
			{ID: "ip_event", Name: "IP Event", Description: "IP-related event", Category: "Network"},
			{ID: "dhcp_lease", Name: "DHCP Lease", Description: "DHCP lease assigned", Category: "Network"},
			{ID: "dhcp_release", Name: "DHCP Release", Description: "DHCP lease released", Category: "Network"},
			{ID: "dhcp_event", Name: "DHCP Event", Description: "DHCP event", Category: "Network"},
			{ID: "hsrp_active", Name: "HSRP Active", Description: "HSRP became active", Category: "Network"},
			{ID: "hsrp_standby", Name: "HSRP Standby", Description: "HSRP became standby", Category: "Network"},
			{ID: "hsrp_state_change", Name: "HSRP State Change", Description: "HSRP state changed", Category: "Network"},
			{ID: "hsrp_event", Name: "HSRP Event", Description: "HSRP event", Category: "Network"},
			{ID: "vrrp_master", Name: "VRRP Master", Description: "VRRP became master", Category: "Network"},
			{ID: "vrrp_backup", Name: "VRRP Backup", Description: "VRRP became backup", Category: "Network"},
			{ID: "vrrp_state_change", Name: "VRRP State Change", Description: "VRRP state changed", Category: "Network"},
			{ID: "stp_topology_change", Name: "STP Topology Change", Description: "STP topology changed", Category: "Network"},
			{ID: "stp_port_change", Name: "STP Port Change", Description: "STP port state changed", Category: "Network"},
			{ID: "stp_event", Name: "STP Event", Description: "STP event", Category: "Network"},

			// VPN Events
			{ID: "ipsec_tunnel_up", Name: "IPsec Tunnel Up", Description: "IPsec tunnel established", Category: "VPN"},
			{ID: "ipsec_tunnel_down", Name: "IPsec Tunnel Down", Description: "IPsec tunnel torn down", Category: "VPN"},
			{ID: "ipsec_event", Name: "IPsec Event", Description: "IPsec event", Category: "VPN"},
			{ID: "ike_event", Name: "IKE Event", Description: "IKE event", Category: "VPN"},
			{ID: "crypto_event", Name: "Crypto Event", Description: "Crypto/VPN event", Category: "VPN"},
		},
		CommonFields: []FieldInfo{
			{Key: "facility", Label: "Facility", Description: "Cisco facility code", Type: "string", Examples: []string{"LINK", "LINEPROTO", "SYS", "OSPF", "BGP"}},
			{Key: "severity", Label: "Severity", Description: "Message severity (0-7)", Type: "number", Examples: []string{"0", "1", "2", "3", "4", "5", "6", "7"}},
			{Key: "mnemonic", Label: "Mnemonic", Description: "Cisco mnemonic code", Type: "string", Examples: []string{"UPDOWN", "CONFIG_I", "ADJCHG"}},
			{Key: "interface", Label: "Interface", Description: "Interface name", Type: "string", Examples: []string{"GigabitEthernet0/0", "FastEthernet0/1", "Vlan1"}},
			{Key: "state", Label: "State", Description: "Interface or protocol state", Type: "string", Examples: []string{"up", "down", "active", "standby"}},
			{Key: "source_ip", Label: "Source IP", Description: "Source IP address", Type: "ip"},
			{Key: "dest_ip", Label: "Destination IP", Description: "Destination IP address", Type: "ip"},
			{Key: "neighbor_ip", Label: "Neighbor IP", Description: "Neighbor IP address (routing protocols)", Type: "ip"},
			{Key: "user", Label: "User", Description: "Username", Type: "string"},
			{Key: "line", Label: "Line", Description: "Console/VTY line", Type: "string", Examples: []string{"console", "vty0", "vty2"}},
			{Key: "protocol", Label: "Protocol", Description: "Routing protocol", Type: "string", Examples: []string{"OSPF", "BGP", "EIGRP"}},
			{Key: "acl_name", Label: "ACL Name", Description: "Access control list name", Type: "string"},
			{Key: "vlan", Label: "VLAN", Description: "VLAN ID", Type: "number"},
			{Key: "group", Label: "Group", Description: "HSRP/VRRP group number", Type: "number"},
			{Key: "reason", Label: "Reason", Description: "Event reason or cause", Type: "string"},
		},
		FilterSuggestions: []FilterSuggestion{
			{Field: "event_type", Label: "Event Type", Type: "select", Options: []string{"interface_up", "interface_down", "configuration_change", "ospf_neighbor_up", "bgp_neighbor_up", "login_success", "login_failure"}},
			{Field: "facility", Label: "Facility", Type: "select", Options: []string{"LINK", "LINEPROTO", "SYS", "OSPF", "BGP", "SEC_LOGIN", "ACL"}},
			{Field: "severity", Label: "Severity", Type: "select", Options: []string{"0", "1", "2", "3", "4", "5", "6", "7"}},
			{Field: "state", Label: "State", Type: "select", Options: []string{"up", "down", "active", "standby"}},
		},
		WidgetHints: []WidgetHint{
			{WidgetType: "top-n", Title: "Top Interfaces", Config: map[string]interface{}{"field": "interface"}},
			{WidgetType: "top-n", Title: "Top Facilities", Config: map[string]interface{}{"field": "facility"}},
			{WidgetType: "top-n", Title: "Top Event Types", Config: map[string]interface{}{"field": "event_type"}},
			{WidgetType: "chart-event-type", Title: "Event Category Distribution", Config: map[string]interface{}{"groupBy": "event_category"}},
		},
	}
}

func (c *CiscoModule) GetDisplayInfo(entry *ParsedLog) *DisplayInfo {
	info := &DisplayInfo{
		Details:  []DetailItem{},
		Badges:   []Badge{},
		Actions:  []Action{},
		Metadata: make(map[string]string),
	}

	// Set default icon and color
	info.Icon = "🔌"
	info.Color = "#0066cc"
	info.Title = entry.EventType
	info.Description = entry.RawMessage

	// Get facility and severity for display
	facility := ""
	severity := 6
	if f, ok := entry.Fields["facility"].(string); ok {
		facility = f
	}
	if s, ok := entry.Fields["severity"].(int); ok {
		severity = s
	}

	// Set icon and color based on event type and severity
	switch entry.EventType {
	case "interface_up", "line_protocol_up":
		info.Icon = "✅"
		info.Color = "#10b981"
		info.Title = "Interface Up"
		if iface, ok := entry.Fields["interface"].(string); ok {
			info.Description = fmt.Sprintf("Interface %s is up", iface)
			info.Badges = append(info.Badges, Badge{Label: "Interface", Color: "#10b981", Value: iface})
		}

	case "interface_down", "line_protocol_down":
		info.Icon = "❌"
		info.Color = "#ef4444"
		info.Title = "Interface Down"
		if iface, ok := entry.Fields["interface"].(string); ok {
			info.Description = fmt.Sprintf("Interface %s is down", iface)
			info.Badges = append(info.Badges, Badge{Label: "Interface", Color: "#ef4444", Value: iface})
		}

	case "configuration_change":
		info.Icon = "⚙️"
		info.Color = "#6366f1"
		info.Title = "Configuration Change"
		info.Description = "Device configuration was modified"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "User", Color: "#6366f1", Value: user})
		}
		if line, ok := entry.Fields["line"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Line", Value: line, Type: "text"})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}

	case "ospf_neighbor_up", "bgp_neighbor_up":
		info.Icon = "🤝"
		info.Color = "#10b981"
		info.Title = "Neighbor Up"
		if protocol, ok := entry.Fields["protocol"].(string); ok {
			info.Title = fmt.Sprintf("%s Neighbor Up", protocol)
			info.Badges = append(info.Badges, Badge{Label: "Protocol", Color: "#6366f1", Value: protocol})
		}
		if neighborIP, ok := entry.Fields["neighbor_ip"].(string); ok {
			info.Description = fmt.Sprintf("Neighbor %s is up", neighborIP)
			info.Details = append(info.Details, DetailItem{Label: "Neighbor IP", Value: neighborIP, Type: "ip"})
		}
		if iface, ok := entry.Fields["interface"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Interface", Value: iface, Type: "text"})
		}

	case "ospf_neighbor_down", "bgp_neighbor_down":
		info.Icon = "🔴"
		info.Color = "#ef4444"
		info.Title = "Neighbor Down"
		if protocol, ok := entry.Fields["protocol"].(string); ok {
			info.Title = fmt.Sprintf("%s Neighbor Down", protocol)
			info.Badges = append(info.Badges, Badge{Label: "Protocol", Color: "#ef4444", Value: protocol})
		}
		if neighborIP, ok := entry.Fields["neighbor_ip"].(string); ok {
			info.Description = fmt.Sprintf("Neighbor %s is down", neighborIP)
			info.Details = append(info.Details, DetailItem{Label: "Neighbor IP", Value: neighborIP, Type: "ip"})
		}

	case "login_success", "authentication_success":
		info.Icon = "🔑"
		info.Color = "#10b981"
		info.Title = "Login Success"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Description = fmt.Sprintf("User %s logged in successfully", user)
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "User", Color: "#10b981", Value: user})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}

	case "login_failure", "authentication_failure":
		info.Icon = "🚫"
		info.Color = "#ef4444"
		info.Title = "Login Failure"
		info.Description = "Failed login attempt"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
			info.Badges = append(info.Badges, Badge{Label: "Source IP", Color: "#ef4444", Value: srcIP})
		}

	case "acl_denied":
		info.Icon = "🛡️"
		info.Color = "#ef4444"
		info.Title = "ACL Denied"
		info.Description = "Traffic denied by access control list"
		if aclName, ok := entry.Fields["acl_name"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "ACL Name", Value: aclName, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "ACL", Color: "#ef4444", Value: aclName})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}
		if dstIP, ok := entry.Fields["dest_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination IP", Value: dstIP, Type: "ip"})
		}

	case "ipsec_tunnel_up":
		info.Icon = "🔐"
		info.Color = "#10b981"
		info.Title = "IPsec Tunnel Up"
		info.Description = "IPsec tunnel established"
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}
		if dstIP, ok := entry.Fields["dest_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination IP", Value: dstIP, Type: "ip"})
		}

	case "ipsec_tunnel_down":
		info.Icon = "🔓"
		info.Color = "#ef4444"
		info.Title = "IPsec Tunnel Down"
		info.Description = "IPsec tunnel torn down"

	case "hsrp_active", "vrrp_master":
		info.Icon = "👑"
		info.Color = "#10b981"
		info.Title = "HSRP/VRRP Active"
		if group, ok := entry.Fields["group"].(int); ok {
			info.Description = fmt.Sprintf("HSRP/VRRP group %d became active", group)
			info.Badges = append(info.Badges, Badge{Label: "Group", Color: "#10b981", Value: fmt.Sprintf("%d", group)})
		}
		if iface, ok := entry.Fields["interface"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Interface", Value: iface, Type: "text"})
		}

	case "system_restart", "system_reload":
		info.Icon = "🔄"
		info.Color = "#f59e0b"
		info.Title = "System Restart"
		info.Description = "System was restarted or reloaded"

	default:
		// Generic display based on severity
		severityColors := map[int]string{
			0: "#ef4444", 1: "#f97316", 2: "#ef4444", 3: "#f59e0b",
			4: "#eab308", 5: "#84cc16", 6: "#10b981", 7: "#14b8a6",
		}
		if color, ok := severityColors[severity]; ok {
			info.Color = color
		}
		info.Title = strings.ReplaceAll(entry.EventType, "_", " ")
		info.Title = strings.Title(info.Title)
	}

	// Add facility badge
	if facility != "" {
		info.Badges = append(info.Badges, Badge{Label: "Facility", Color: info.Color, Value: facility})
	}

	// Add severity badge
	severityNames := map[int]string{
		0: "Emergency", 1: "Alert", 2: "Critical", 3: "Error",
		4: "Warning", 5: "Notice", 6: "Informational", 7: "Debug",
	}
	if name, ok := severityNames[severity]; ok {
		severityColors := map[int]string{
			0: "#ef4444", 1: "#f97316", 2: "#ef4444", 3: "#f59e0b",
			4: "#eab308", 5: "#84cc16", 6: "#10b981", 7: "#14b8a6",
		}
		if color, ok := severityColors[severity]; ok {
			info.Badges = append(info.Badges, Badge{Label: "Severity", Color: color, Value: name})
		}
	}

	// Add common details
	if mnemonic, ok := entry.Fields["mnemonic"].(string); ok {
		info.Details = append(info.Details, DetailItem{Label: "Mnemonic", Value: mnemonic, Type: "text"})
	}
	if desc, ok := entry.Fields["description"].(string); ok && desc != "" {
		info.Details = append(info.Details, DetailItem{Label: "Description", Value: desc, Type: "text"})
	}

	return info
}
