package modules

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type UbiquitiModule struct{}

func NewUbiquitiModule() *UbiquitiModule {
	return &UbiquitiModule{}
}

func (u *UbiquitiModule) GetDeviceName() string {
	return "ubiquiti"
}

func (u *UbiquitiModule) Detect(rawMessage string) bool {
	// Detect CEF format with Ubiquiti vendor
	cefPattern := regexp.MustCompile(`CEF:\d+\|Ubiquiti\|`)
	if cefPattern.MatchString(rawMessage) {
		return true
	}

	// Detect device-level logs from Ubiquiti devices
	// Common patterns: hostname contains UniFi device names, or process names like charon, unifi, etc.
	ubiquitiPatterns := []string{
		"charon",         // IPsec/strongSwan
		"unifi",          // UniFi processes
		"ubnt",           // Ubiquiti processes
		"mca-monitor",    // UniFi monitoring
		"mca-client",     // UniFi client
		"mca-alert",      // UniFi alerts
		"kernel",         // Kernel messages (common on UniFi devices)
		"sshd",           // SSH daemon (common on UniFi devices)
		"dhcp",           // DHCP events
		"dnsmasq",        // DNS service
		"hostapd",        // WiFi access point daemon
		"wpa_supplicant", // WiFi supplicant
	}

	lowerMsg := strings.ToLower(rawMessage)
	for _, pattern := range ubiquitiPatterns {
		if strings.Contains(lowerMsg, pattern) {
			// Additional check: look for common UniFi hostname patterns or device models
			hostnamePatterns := []string{
				"unifi", "ubiquiti", "ucg", "udm", "usg", "uxg", "dream", "cloud", "gateway",
			}
			for _, hostPattern := range hostnamePatterns {
				if strings.Contains(lowerMsg, hostPattern) {
					return true
				}
			}
		}
	}

	return false
}

func (u *UbiquitiModule) GetEventType(rawMessage string) string {
	// Parse CEF format: CEF:Version|Vendor|Product|Version|EventClassID|Name|Severity|[Extension]
	cefPattern := regexp.MustCompile(`CEF:\d+\|[^|]+\|[^|]+\|[^|]+\|[^|]+\|([^|]+)\|`)
	matches := cefPattern.FindStringSubmatch(rawMessage)
	if len(matches) > 1 {
		eventName := matches[1]
		// Normalize event name to event type
		eventName = strings.ToLower(strings.ReplaceAll(eventName, " ", "_"))
		return eventName
	}

	// Try to extract from UNIFIcategory and UNIFIsubCategory
	kvPairs := ExtractKeyValuePairs(rawMessage)
	if category, ok := kvPairs["UNIFIcategory"]; ok {
		categoryStr := strings.ToLower(category)
		if subCategory, ok := kvPairs["UNIFIsubCategory"]; ok {
			subCategoryStr := strings.ToLower(strings.ReplaceAll(subCategory, " ", "_"))
			return fmt.Sprintf("%s_%s", categoryStr, subCategoryStr)
		}
		return categoryStr
	}

	// Detect device-level log types
	lowerMsg := strings.ToLower(rawMessage)

	// IPsec/strongSwan (charon) events
	if strings.Contains(lowerMsg, "charon") {
		if strings.Contains(lowerMsg, "ike_sa") || strings.Contains(lowerMsg, "ike-sa") {
			if strings.Contains(lowerMsg, "established") {
				return "ipsec_ike_established"
			}
			if strings.Contains(lowerMsg, "deleted") || strings.Contains(lowerMsg, "closing") {
				return "ipsec_ike_closed"
			}
		}
		if strings.Contains(lowerMsg, "child_sa") || strings.Contains(lowerMsg, "child-sa") {
			if strings.Contains(lowerMsg, "established") {
				return "ipsec_child_established"
			}
			if strings.Contains(lowerMsg, "closing") || strings.Contains(lowerMsg, "deleted") {
				return "ipsec_child_closed"
			}
		}
		if strings.Contains(lowerMsg, "generating") || strings.Contains(lowerMsg, "received") {
			return "ipsec_message"
		}
		return "ipsec_event"
	}

	// SSH events
	if strings.Contains(lowerMsg, "sshd") {
		if strings.Contains(lowerMsg, "accepted") || strings.Contains(lowerMsg, "successful") {
			return "ssh_login_success"
		}
		if strings.Contains(lowerMsg, "failed") || strings.Contains(lowerMsg, "authentication failure") {
			return "ssh_login_failed"
		}
		if strings.Contains(lowerMsg, "disconnected") {
			return "ssh_disconnected"
		}
		return "ssh_event"
	}

	// Kernel events
	if strings.Contains(lowerMsg, "kernel:") {
		if strings.Contains(lowerMsg, "link up") || strings.Contains(lowerMsg, "link_down") {
			return "interface_state_change"
		}
		if strings.Contains(lowerMsg, "ufw") || strings.Contains(lowerMsg, "firewall") {
			return "firewall_event"
		}
		return "kernel_event"
	}

	// DHCP events
	if strings.Contains(lowerMsg, "dhcp") {
		if strings.Contains(lowerMsg, "lease") {
			return "dhcp_lease"
		}
		if strings.Contains(lowerMsg, "release") {
			return "dhcp_release"
		}
		return "dhcp_event"
	}

	// DNS events
	if strings.Contains(lowerMsg, "dnsmasq") {
		return "dns_event"
	}

	// WiFi events
	if strings.Contains(lowerMsg, "hostapd") || strings.Contains(lowerMsg, "wpa_supplicant") {
		if strings.Contains(lowerMsg, "associated") || strings.Contains(lowerMsg, "association") {
			return "wifi_association"
		}
		if strings.Contains(lowerMsg, "disassociated") || strings.Contains(lowerMsg, "disassociation") {
			return "wifi_disassociation"
		}
		return "wifi_event"
	}

	// UniFi-specific processes
	if strings.Contains(lowerMsg, "mca-") {
		if strings.Contains(lowerMsg, "monitor") {
			return "unifi_monitoring"
		}
		if strings.Contains(lowerMsg, "client") {
			return "unifi_client_event"
		}
		if strings.Contains(lowerMsg, "alert") {
			return "unifi_alert"
		}
		return "unifi_system_event"
	}

	return "unknown"
}

func (u *UbiquitiModule) Parse(rawMessage string, entry *ParsedLog) *ParsedLog {
	entry.DeviceType = "ubiquiti"
	entry.EventType = u.GetEventType(rawMessage)
	entry.Fields = make(map[string]interface{})

	// Parse CEF header
	cefPattern := regexp.MustCompile(`CEF:(\d+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|(.*)`)
	matches := cefPattern.FindStringSubmatch(rawMessage)
	if len(matches) >= 9 {
		entry.Fields["cef_version"] = matches[1]
		entry.Fields["vendor"] = matches[2]
		entry.Fields["product"] = matches[3]
		entry.Fields["product_version"] = matches[4]
		entry.Fields["event_class_id"] = matches[5]
		entry.Fields["event_name"] = matches[6]
		entry.Fields["severity"] = matches[7]

		// Parse extension fields - handle both space-separated and escaped values
		extension := matches[8]
		kvPairs := u.parseCEFExtension(extension)
		for k, v := range kvPairs {
			entry.Fields[k] = v
		}
	} else {
		// Parse device-level logs (non-CEF format)
		u.parseDeviceLevelLog(rawMessage, entry)
	}

	// Extract category and subcategory
	if category, ok := entry.Fields["UNIFIcategory"].(string); ok {
		entry.EventCategory = category
		if subCategory, ok := entry.Fields["UNIFIsubCategory"].(string); ok {
			entry.EventCategory = fmt.Sprintf("%s / %s", category, subCategory)
		}
	} else {
		// Try to infer from event type
		entry.EventCategory = u.inferCategory(entry.EventType)
	}

	// Extract host information
	if host, ok := entry.Fields["UNIFIhost"].(string); ok {
		entry.Fields["host"] = host
	}

	// Extract message
	if msg, ok := entry.Fields["msg"].(string); ok {
		entry.Fields["message"] = msg
	}

	return entry
}

// parseCEFExtension parses CEF extension fields, handling escaped values and spaces
func (u *UbiquitiModule) parseCEFExtension(extension string) map[string]string {
	result := make(map[string]string)

	// CEF extension format: key=value key=value (values can contain spaces)
	// Split by space, but handle values that contain spaces (they're typically not escaped in CEF)
	// Simple approach: split on space, then check if each part is key=value
	parts := strings.Fields(extension)
	currentKey := ""
	currentValue := ""

	for _, part := range parts {
		if strings.Contains(part, "=") {
			// Save previous key-value pair if exists
			if currentKey != "" {
				result[currentKey] = strings.TrimSpace(currentValue)
			}
			// Start new key-value pair
			kv := strings.SplitN(part, "=", 2)
			if len(kv) == 2 {
				currentKey = kv[0]
				currentValue = kv[1]
			} else {
				currentKey = ""
				currentValue = ""
			}
		} else if currentKey != "" {
			// Continuation of current value (space-separated)
			currentValue += " " + part
		}
	}

	// Save last key-value pair
	if currentKey != "" {
		result[currentKey] = strings.TrimSpace(currentValue)
	}

	// Fallback to simple key-value extraction if we got nothing
	if len(result) == 0 {
		result = ExtractKeyValuePairs(extension)
	}

	return result
}

// parseDeviceLevelLog parses non-CEF device-level logs (charon, sshd, kernel, etc.)
func (u *UbiquitiModule) parseDeviceLevelLog(rawMessage string, entry *ParsedLog) {
	// Extract process name and PID (e.g., "charon[2530]")
	processPattern := regexp.MustCompile(`(\w+)\[(\d+)\]:`)
	processMatches := processPattern.FindStringSubmatch(rawMessage)
	if len(processMatches) >= 3 {
		entry.Fields["process_name"] = processMatches[1]
		entry.Fields["process_id"] = processMatches[2]
	}

	// Extract IP addresses
	ipPattern := regexp.MustCompile(`\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b`)
	ips := ipPattern.FindAllString(rawMessage, -1)
	if len(ips) > 0 {
		entry.Fields["source_ip"] = ips[0]
		if len(ips) > 1 {
			entry.Fields["dest_ip"] = ips[1]
		}
	}

	// Extract MAC addresses
	macPattern := regexp.MustCompile(`\b([0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2}[:-][0-9A-Fa-f]{2})\b`)
	macs := macPattern.FindAllString(rawMessage, -1)
	if len(macs) > 0 {
		entry.Fields["mac_address"] = macs[0]
	}

	// Extract ports
	portPattern := regexp.MustCompile(`port\s+(\d+)`)
	portMatches := portPattern.FindStringSubmatch(rawMessage)
	if len(portMatches) >= 2 {
		entry.Fields["port"] = portMatches[1]
	}

	// Parse key-value pairs
	kvPairs := ExtractKeyValuePairs(rawMessage)
	for k, v := range kvPairs {
		entry.Fields[k] = v
	}

	// Extract specific patterns based on event type
	switch entry.EventType {
	case "ipsec_ike_established", "ipsec_child_established":
		// Extract IKE/Child SA information
		if match := regexp.MustCompile(`\[(\d+)\]`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["sa_id"] = match[1]
		}
		if match := regexp.MustCompile(`between\s+([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["local_ip"] = match[1]
		}
		if match := regexp.MustCompile(`\.\.\.\s*([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["remote_ip"] = match[1]
		}

	case "ssh_login_success", "ssh_login_failed":
		// Extract user and source IP
		if match := regexp.MustCompile(`(?:for|user)\s+(\w+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["user"] = match[1]
		}
		if match := regexp.MustCompile(`from\s+([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["source_ip"] = match[1]
		}

	case "interface_state_change":
		// Extract interface name
		if match := regexp.MustCompile(`(\w+):\s+link\s+(up|down)`).FindStringSubmatch(rawMessage); len(match) >= 3 {
			entry.Fields["interface"] = match[1]
			entry.Fields["link_state"] = match[2]
		}

	case "firewall_event":
		// Extract firewall action and details
		if strings.Contains(rawMessage, "BLOCK") {
			entry.Fields["action"] = "blocked"
		} else if strings.Contains(rawMessage, "ALLOW") {
			entry.Fields["action"] = "allowed"
		}
		if match := regexp.MustCompile(`SRC=([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["source_ip"] = match[1]
		}
		if match := regexp.MustCompile(`DST=([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["dest_ip"] = match[1]
		}
		if match := regexp.MustCompile(`PROTO=(\w+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["protocol"] = match[1]
		}
		if match := regexp.MustCompile(`DPT=(\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["dest_port"] = match[1]
		}
		if match := regexp.MustCompile(`SPT=(\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["source_port"] = match[1]
		}
	}
}

func (u *UbiquitiModule) inferCategory(eventType string) string {
	eventTypeLower := strings.ToLower(eventType)

	if strings.Contains(eventTypeLower, "admin") || strings.Contains(eventTypeLower, "system") {
		return "System"
	}
	if strings.Contains(eventTypeLower, "wifi") || strings.Contains(eventTypeLower, "client") || strings.Contains(eventTypeLower, "roaming") {
		return "Monitoring"
	}
	if strings.Contains(eventTypeLower, "firewall") || strings.Contains(eventTypeLower, "threat") || strings.Contains(eventTypeLower, "honeypot") || strings.Contains(eventTypeLower, "intrusion") {
		return "Security"
	}
	if strings.Contains(eventTypeLower, "outage") || strings.Contains(eventTypeLower, "failover") || strings.Contains(eventTypeLower, "performance") || strings.Contains(eventTypeLower, "latency") || strings.Contains(eventTypeLower, "packet_loss") {
		return "Internet"
	}
	if strings.Contains(eventTypeLower, "poe") || strings.Contains(eventTypeLower, "power") || strings.Contains(eventTypeLower, "redundancy") {
		return "Power"
	}
	if strings.Contains(eventTypeLower, "device") || strings.Contains(eventTypeLower, "adopted") || strings.Contains(eventTypeLower, "offline") {
		return "System"
	}
	if strings.Contains(eventTypeLower, "vpn") {
		return "System"
	}
	if strings.Contains(eventTypeLower, "network") {
		return "System"
	}

	return "System"
}

func (u *UbiquitiModule) GetMetadata() *ModuleMetadata {
	return &ModuleMetadata{
		DeviceType:  "ubiquiti",
		DeviceName:  "Ubiquiti",
		Description: "Ubiquiti UniFi devices (USG, UDM, UCG, UAP etc.) (CEF format)",
		ImageURL:    "https://logosandtypes.com/wp-content/uploads/2023/11/UniFi.png",
		EventTypes: []EventTypeInfo{
			// CEF Event Types
			{ID: "wired_client_connected", Name: "Wired Client Connected", Description: "Wired client connected to switch", Category: "Monitoring"},
			{ID: "wired_client_disconnected", Name: "Wired Client Disconnected", Description: "Wired client disconnected from switch", Category: "Monitoring"},
			{ID: "wifi_client_connected", Name: "WiFi Client Connected", Description: "WiFi client connected to access point", Category: "Monitoring"},
			{ID: "wifi_client_disconnected", Name: "WiFi Client Disconnected", Description: "WiFi client disconnected from access point", Category: "Monitoring"},
			{ID: "blocked_by_firewall", Name: "Blocked by Firewall", Description: "Traffic blocked by firewall policy", Category: "Security"},
			{ID: "temporary_internet_disconnection", Name: "Temporary Internet Disconnection", Description: "Temporary WAN disconnection", Category: "Internet"},
			{ID: "admin_accessed_unifi_network", Name: "Admin Accessed UniFi Network", Description: "Admin accessed UniFi Network", Category: "System"},
			{ID: "device_adopted", Name: "Device Adopted", Description: "Device was adopted into UniFi network", Category: "System"},
			{ID: "device_offline", Name: "Device Offline", Description: "Device went offline", Category: "System"},
			{ID: "device_online", Name: "Device Online", Description: "Device came online", Category: "System"},
			{ID: "wan_failover", Name: "WAN Failover", Description: "WAN failover event", Category: "Internet"},
			{ID: "high_latency_detected", Name: "High Latency Detected", Description: "High network latency detected", Category: "Internet"},
			{ID: "packet_loss_detected", Name: "Packet Loss Detected", Description: "Packet loss detected", Category: "Internet"},
			{ID: "threat_detected_and_blocked", Name: "Threat Detected and Blocked", Description: "Security threat detected and blocked", Category: "Security"},
			{ID: "honeypot_triggered", Name: "Honeypot Triggered", Description: "Honeypot intrusion detection triggered", Category: "Security"},
			{ID: "insufficient_poe_output", Name: "Insufficient PoE Output", Description: "Insufficient PoE power output", Category: "Power"},
			{ID: "poe_availability_exceeded", Name: "PoE Availability Exceeded", Description: "PoE availability exceeded", Category: "Power"},
			{ID: "ap_underpowered", Name: "AP Underpowered", Description: "Access point is underpowered", Category: "Power"},
			// Device-Level Event Types
			{ID: "ipsec_ike_established", Name: "IPsec IKE SA Established", Description: "IPsec IKE security association established", Category: "VPN"},
			{ID: "ipsec_ike_closed", Name: "IPsec IKE SA Closed", Description: "IPsec IKE security association closed", Category: "VPN"},
			{ID: "ipsec_child_established", Name: "IPsec Child SA Established", Description: "IPsec child security association established", Category: "VPN"},
			{ID: "ipsec_child_closed", Name: "IPsec Child SA Closed", Description: "IPsec child security association closed", Category: "VPN"},
			{ID: "ipsec_message", Name: "IPsec Message", Description: "IPsec/strongSwan message", Category: "VPN"},
			{ID: "ipsec_event", Name: "IPsec Event", Description: "IPsec/strongSwan event", Category: "VPN"},
			{ID: "ssh_login_success", Name: "SSH Login Success", Description: "Successful SSH login", Category: "Security"},
			{ID: "ssh_login_failed", Name: "SSH Login Failed", Description: "Failed SSH login attempt", Category: "Security"},
			{ID: "ssh_disconnected", Name: "SSH Disconnected", Description: "SSH session disconnected", Category: "Security"},
			{ID: "ssh_event", Name: "SSH Event", Description: "SSH daemon event", Category: "Security"},
			{ID: "interface_state_change", Name: "Interface State Change", Description: "Network interface state changed", Category: "Network"},
			{ID: "firewall_event", Name: "Firewall Event", Description: "Firewall rule matched", Category: "Security"},
			{ID: "kernel_event", Name: "Kernel Event", Description: "Kernel/system event", Category: "System"},
			{ID: "dhcp_lease", Name: "DHCP Lease", Description: "DHCP lease assigned", Category: "Network"},
			{ID: "dhcp_release", Name: "DHCP Release", Description: "DHCP lease released", Category: "Network"},
			{ID: "dhcp_event", Name: "DHCP Event", Description: "DHCP service event", Category: "Network"},
			{ID: "dns_event", Name: "DNS Event", Description: "DNS service event", Category: "Network"},
			{ID: "wifi_association", Name: "WiFi Association", Description: "WiFi client association", Category: "Wireless"},
			{ID: "wifi_disassociation", Name: "WiFi Disassociation", Description: "WiFi client disassociation", Category: "Wireless"},
			{ID: "wifi_event", Name: "WiFi Event", Description: "WiFi access point event", Category: "Wireless"},
			{ID: "unifi_monitoring", Name: "UniFi Monitoring", Description: "UniFi monitoring event", Category: "Monitoring"},
			{ID: "unifi_client_event", Name: "UniFi Client Event", Description: "UniFi client event", Category: "Monitoring"},
			{ID: "unifi_alert", Name: "UniFi Alert", Description: "UniFi alert event", Category: "System"},
			{ID: "unifi_system_event", Name: "UniFi System Event", Description: "UniFi system event", Category: "System"},
		},
		CommonFields: []FieldInfo{
			{Key: "UNIFIhost", Label: "UniFi Host", Description: "UniFi device hostname", Type: "string", Examples: []string{"Jacks Cloud Gateway Ultra"}},
			{Key: "UNIFIcategory", Label: "UniFi Category", Description: "Event category", Type: "string", Examples: []string{"Monitoring", "Security", "Internet", "System"}},
			{Key: "UNIFIsubCategory", Label: "UniFi Sub Category", Description: "Event subcategory", Type: "string", Examples: []string{"Wired", "WiFi", "Firewall", "Outage & Failover"}},
			{Key: "UNIFIclientIp", Label: "UniFi Client IP", Description: "Client IP address", Type: "ip"},
			{Key: "UNIFIclientMac", Label: "UniFi Client MAC", Description: "Client MAC address", Type: "mac"},
			{Key: "UNIFIclientHostname", Label: "UniFi Client Hostname", Description: "Client hostname", Type: "string"},
			{Key: "UNIFIclientAlias", Label: "UniFi Client Alias", Description: "Client alias/name", Type: "string"},
			{Key: "UNIFIconnectedToDeviceName", Label: "Connected To Device", Description: "Device the client is connected to", Type: "string"},
			{Key: "UNIFIconnectedToDevicePort", Label: "Connected To Port", Description: "Port number on connected device", Type: "port"},
			{Key: "UNIFIconnectedToDeviceIp", Label: "Connected To Device IP", Description: "IP address of connected device", Type: "ip"},
			{Key: "UNIFIconnectedToDeviceMac", Label: "Connected To Device MAC", Description: "MAC address of connected device", Type: "mac"},
			{Key: "UNIFIconnectedToDeviceModel", Label: "Connected To Device Model", Description: "Model of connected device", Type: "string"},
			{Key: "UNIFIlinkSpeed", Label: "Link Speed", Description: "Network link speed", Type: "string", Examples: []string{"GbE", "100MbE"}},
			{Key: "UNIFInetworkName", Label: "Network Name", Description: "Network/VLAN name", Type: "string"},
			{Key: "UNIFInetworkSubnet", Label: "Network Subnet", Description: "Network subnet", Type: "string"},
			{Key: "UNIFInetworkVlan", Label: "Network VLAN", Description: "VLAN ID", Type: "number"},
			{Key: "src", Label: "Source IP", Description: "Source IP address", Type: "ip"},
			{Key: "dst", Label: "Destination IP", Description: "Destination IP address", Type: "ip"},
			{Key: "proto", Label: "Protocol", Description: "Network protocol", Type: "string", Examples: []string{"UDP", "TCP"}},
			{Key: "spt", Label: "Source Port", Description: "Source port", Type: "port"},
			{Key: "dpt", Label: "Destination Port", Description: "Destination port", Type: "port"},
			{Key: "act", Label: "Action", Description: "Firewall action", Type: "string", Examples: []string{"blocked", "allowed"}},
		},
		FilterSuggestions: []FilterSuggestion{
			{Field: "UNIFIcategory", Label: "UniFi Category", Type: "select", Options: []string{"Monitoring", "Security", "Internet", "Power", "System"}},
			{Field: "UNIFIsubCategory", Label: "UniFi Sub Category", Type: "select", Options: []string{"Wired", "WiFi", "Firewall", "Outage & Failover"}},
			{Field: "act", Label: "Action", Type: "select", Options: []string{"blocked", "allowed"}},
		},
		WidgetHints: []WidgetHint{
			{WidgetType: "top-n", Title: "Top UniFi Hosts", Config: map[string]interface{}{"field": "UNIFIhost"}},
			{WidgetType: "top-n", Title: "Top Client IPs", Config: map[string]interface{}{"field": "UNIFIclientIp"}},
			{WidgetType: "top-n", Title: "Top Categories", Config: map[string]interface{}{"field": "UNIFIcategory"}},
			{WidgetType: "chart-event-type", Title: "Event Category Distribution", Config: map[string]interface{}{"groupBy": "event_category"}},
		},
	}
}

func (u *UbiquitiModule) GetDisplayInfo(entry *ParsedLog) *DisplayInfo {
	displayInfo := &DisplayInfo{
		Icon:        "fa-network-wired",
		Color:       "#0066cc",
		Title:       entry.EventType,
		Description: "",
		Badges:      []Badge{},
		Details:     []DetailItem{},
		Actions:     []Action{},
		Metadata:    make(map[string]string),
	}

	// Extract message for description (prefer msg field over raw message)
	if msg, ok := entry.Fields["msg"].(string); ok && msg != "" {
		displayInfo.Description = msg
	} else {
		// Fallback to raw message if no msg field
		displayInfo.Description = entry.RawMessage
	}

	// Set icon and color based on category and event type
	category := entry.EventCategory
	eventType := strings.ToLower(entry.EventType)

	// Check for wired client events first (before general Monitoring category)
	if strings.Contains(eventType, "wired_client") {
		displayInfo.Icon = "fa-network-wired"
		displayInfo.Color = "#10b981"
	} else if strings.Contains(category, "Security") {
		displayInfo.Icon = "fa-shield-alt"
		displayInfo.Color = "#ef4444"
	} else if strings.Contains(category, "Monitoring") {
		// Default to wifi icon for monitoring events (unless it's wired)
		displayInfo.Icon = "fa-wifi"
		displayInfo.Color = "#10b981"
	} else if strings.Contains(category, "Internet") {
		displayInfo.Icon = "fa-globe"
		displayInfo.Color = "#f59e0b"
	} else if strings.Contains(category, "Power") {
		displayInfo.Icon = "fa-plug"
		displayInfo.Color = "#8b5cf6"
	} else {
		displayInfo.Icon = "fa-server"
		displayInfo.Color = "#0066cc"
	}

	// Extract event name from fields
	if eventName, ok := entry.Fields["event_name"].(string); ok {
		displayInfo.Title = eventName
	} else if entry.EventType != "unknown" {
		// Format event type as title
		displayInfo.Title = strings.ReplaceAll(entry.EventType, "_", " ")
		displayInfo.Title = strings.Title(displayInfo.Title)
	}

	// Add category badge
	if category != "" {
		displayInfo.Badges = append(displayInfo.Badges, Badge{
			Label: "Category",
			Color: displayInfo.Color,
			Value: category,
		})
	}

	// Add severity badge
	if severity, ok := entry.Fields["severity"].(string); ok {
		severityInt, err := strconv.Atoi(severity)
		if err == nil {
			severityColors := map[int]string{
				0: "#ef4444", 1: "#f97316", 2: "#f59e0b", 3: "#eab308",
				4: "#84cc16", 5: "#22c55e", 6: "#10b981", 7: "#14b8a6",
			}
			severityNames := map[int]string{
				0: "Emergency", 1: "Alert", 2: "Critical", 3: "Error",
				4: "Warning", 5: "Notice", 6: "Informational", 7: "Debug",
			}
			if color, ok := severityColors[severityInt]; ok {
				displayInfo.Badges = append(displayInfo.Badges, Badge{
					Label: "Severity",
					Color: color,
					Value: severityNames[severityInt],
				})
			}
		}
	}

	// Add details based on event type and fields
	u.addEventDetails(displayInfo, entry)

	// Add message if available
	if msg, ok := entry.Fields["msg"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Message",
			Value: msg,
			Type:  "text",
		})
	}

	return displayInfo
}

func (u *UbiquitiModule) addEventDetails(displayInfo *DisplayInfo, entry *ParsedLog) {
	// Host information
	if host, ok := entry.Fields["UNIFIhost"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Host",
			Value: host,
			Type:  "text",
		})
	}

	// Admin events
	if admin, ok := entry.Fields["UNIFIadmin"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Admin",
			Value: admin,
			Type:  "text",
		})
	}
	if accessMethod, ok := entry.Fields["UNIFIaccessMethod"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Access Method",
			Value: accessMethod,
			Type:  "text",
		})
	}

	// Source IP
	if src, ok := entry.Fields["src"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Source IP",
			Value: src,
			Type:  "ip",
		})
	}

	// WiFi Client events
	if clientHostname, ok := entry.Fields["UNIFIclientHostname"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Client Hostname",
			Value: clientHostname,
			Type:  "text",
		})
	}
	if clientIp, ok := entry.Fields["UNIFIclientIp"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Client IP",
			Value: clientIp,
			Type:  "ip",
		})
	}
	if clientMac, ok := entry.Fields["UNIFIclientMac"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Client MAC",
			Value: clientMac,
			Type:  "mac",
		})
	}
	if wifiName, ok := entry.Fields["UNIFIwifiName"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "WiFi Network",
			Value: wifiName,
			Type:  "text",
		})
	}
	if lastConnectedToDeviceName, ok := entry.Fields["UNIFIlastConnectedToDeviceName"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Connected To",
			Value: lastConnectedToDeviceName,
			Type:  "text",
		})
	}
	if lastConnectedToWiFiRssi, ok := entry.Fields["UNIFIlastConnectedToWiFiRssi"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "RSSI",
			Value: lastConnectedToWiFiRssi + " dBm",
			Type:  "text",
		})
	}
	if duration, ok := entry.Fields["UNIFIduration"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Duration",
			Value: duration,
			Type:  "text",
		})
	}
	if usageDown, ok := entry.Fields["UNIFIusageDown"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Data Down",
			Value: usageDown,
			Type:  "text",
		})
	}
	if usageUp, ok := entry.Fields["UNIFIusageUp"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Data Up",
			Value: usageUp,
			Type:  "text",
		})
	}

	// Device information
	if deviceName, ok := entry.Fields["UNIFIdeviceName"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Device",
			Value: deviceName,
			Type:  "text",
		})
	}
	if deviceModel, ok := entry.Fields["UNIFIdeviceModel"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Device Model",
			Value: deviceModel,
			Type:  "text",
		})
	}
	if deviceIp, ok := entry.Fields["UNIFIdeviceIp"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Device IP",
			Value: deviceIp,
			Type:  "ip",
		})
	}
	if deviceMac, ok := entry.Fields["UNIFIdeviceMac"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Device MAC",
			Value: deviceMac,
			Type:  "mac",
		})
	}

	// Network information
	if networkName, ok := entry.Fields["UNIFInetworkName"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Network",
			Value: networkName,
			Type:  "text",
		})
	}
	if networkSubnet, ok := entry.Fields["UNIFInetworkSubnet"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "Network Subnet",
			Value: networkSubnet,
			Type:  "text",
		})
	}
	if networkVlan, ok := entry.Fields["UNIFInetworkVlan"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "VLAN",
			Value: networkVlan,
			Type:  "text",
		})
	}

	// Product version
	if productVersion, ok := entry.Fields["product_version"].(string); ok {
		displayInfo.Details = append(displayInfo.Details, DetailItem{
			Label: "UniFi Version",
			Value: productVersion,
			Type:  "text",
		})
	}
}
