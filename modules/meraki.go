package modules

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type MerakiModule struct{}

func NewMerakiModule() *MerakiModule {
	return &MerakiModule{}
}

func (m *MerakiModule) GetDeviceName() string {
	return "meraki"
}

func (m *MerakiModule) Detect(rawMessage string) bool {
	merakiPatterns := []string{
		"MX", "MS", "MR", "MV", "MG", "MT", "labs_appliance", "labs_Z1",
		"events", "urls", "flows", "firewall", "ids-alerts", "security_event",
		"airmarshal_events", "cellular_firewall", "vpn_firewall",
	}

	lowerMsg := strings.ToLower(rawMessage)
	for _, pattern := range merakiPatterns {
		if strings.Contains(lowerMsg, strings.ToLower(pattern)) {
			return true
		}
	}
	return false
}

func (m *MerakiModule) GetEventType(rawMessage string) string {
	patterns := map[string]*regexp.Regexp{
		"vpn_connectivity_change": regexp.MustCompile(`type=vpn_connectivity_change`),
		"vpn_ike_established":     regexp.MustCompile(`IKE_SA.*established`),
		"vpn_child_established":   regexp.MustCompile(`CHILD_SA.*established`),
		"vpn_ike_deleted":         regexp.MustCompile(`deleting IKE_SA|ISAKMP-SA deleted`),
		"vpn_child_closed":        regexp.MustCompile(`closing CHILD_SA|IPsec-SA established`),
		"vpn_phase1_initiate":     regexp.MustCompile(`initiate new phase 1|initiate new phase 2`),
		"vpn_phase2_failed":       regexp.MustCompile(`phase2 negotiation failed|failed to get sainfo|failed to pre-process ph2`),
		"vpn_ipsec_queued":        regexp.MustCompile(`IPsec-SA request queued`),
		"vpn_isakmp_purge":        regexp.MustCompile(`purging ISAKMP-SA`),
		"anyconnect_start":        regexp.MustCompile(`anyconnect.*started`),
		"anyconnect_auth_success": regexp.MustCompile(`anyconnect_vpn_auth_success`),
		"anyconnect_auth_failure": regexp.MustCompile(`anyconnect_vpn_auth_failure`),
		"anyconnect_connect":      regexp.MustCompile(`anyconnect_vpn_connect`),
		"anyconnect_disconnect":   regexp.MustCompile(`anyconnect_vpn_disconnect`),
		"anyconnect_session":      regexp.MustCompile(`anyconnect_vpn_session_manager`),
		"uplink_connectivity":     regexp.MustCompile(`(uplink|Cellular connection|failover)`),
		"dhcp_lease":              regexp.MustCompile(`dhcp lease`),
		"dhcp_no_offers":          regexp.MustCompile(`dhcp no offers`),
		"dhcp_blocked":            regexp.MustCompile(`Blocked DHCP server`),
		"urls":                    regexp.MustCompile(`\burls\b`),
		"firewall":                regexp.MustCompile(`\bfirewall\b|cellular_firewall|vpn_firewall`),
		"flows":                   regexp.MustCompile(`\bflows\b`),
		"ids_alert":               regexp.MustCompile(`ids-alerts|ids_alerted`),
		"security_file_scanned":   regexp.MustCompile(`security_filtering_file_scanned`),
		"security_disposition":    regexp.MustCompile(`security_filtering_disposition_change`),
		"port_status":             regexp.MustCompile(`port.*status changed`),
		"stp_guard":               regexp.MustCompile(`STP BPDU.*blocked|spanning-tree guard`),
		"stp_role_change":         regexp.MustCompile(`STP role|spanning-tree interface role`),
		"8021x_auth":              regexp.MustCompile(`8021x_auth|8021x_eap_success`),
		"8021x_deauth":            regexp.MustCompile(`8021x_deauth|8021x_client_deauth`),
		"8021x_failure":           regexp.MustCompile(`8021x_eap_failure`),
		"vrrp_collision":          regexp.MustCompile(`VRRP.*collision|incompatible configuration`),
		"vrrp_transition":         regexp.MustCompile(`VRRP.*transition|VRRP passive to VRRP active`),
		"power_supply":            regexp.MustCompile(`Power supply.*inserted`),
		"association":             regexp.MustCompile(`type=association`),
		"disassociation":          regexp.MustCompile(`type=disassociation`),
		"wpa_auth":                regexp.MustCompile(`type=wpa_auth`),
		"wpa_deauth":              regexp.MustCompile(`type=wpa_deauth`),
		"wpa_failed":              regexp.MustCompile(`auth_neg_failed.*is_wpa`),
		"splash_auth":             regexp.MustCompile(`type=splash_auth`),
		"packet_flood":            regexp.MustCompile(`device_packet_flood`),
		"rogue_ssid":              regexp.MustCompile(`rogue_ssid_detected`),
		"ssid_spoofing":           regexp.MustCompile(`ssid_spoofing_detected`),
	}

	for eventType, pattern := range patterns {
		if pattern.MatchString(rawMessage) {
			return eventType
		}
	}

	return "unknown"
}

func (m *MerakiModule) Parse(rawMessage string, entry *ParsedLog) *ParsedLog {
	entry.DeviceType = "meraki"
	entry.EventType = m.GetEventType(rawMessage)
	entry.Fields = make(map[string]interface{})

	// Extract device model
	if match := regexp.MustCompile(`(MX\d+|MS\d+|MR\d+|MV\d+|MG\d+|MT\d+|\w+_appliance|\w+_Z\d+)`).FindString(rawMessage); match != "" {
		entry.Fields["device_model"] = match
	}

	// Extract timestamp if present
	if match := regexp.MustCompile(`(\d+\.\d+)`).FindString(rawMessage); match != "" {
		if ts, err := strconv.ParseFloat(match, 64); err == nil {
			entry.Fields["meraki_timestamp"] = time.Unix(int64(ts), int64((ts-float64(int64(ts)))*1e9))
		}
	}

	// Parse key-value pairs
	kvPairs := ExtractKeyValuePairs(rawMessage)
	for k, v := range kvPairs {
		entry.Fields[k] = v
	}

	// Event-specific parsing
	switch entry.EventType {
	case "vpn_connectivity_change":
		entry.EventCategory = "VPN"
		if vpnType, ok := entry.Fields["vpn_type"].(string); ok {
			entry.Fields["vpn_type"] = vpnType
		}
		if peer, ok := entry.Fields["peer_contact"].(string); ok {
			parts := strings.Split(peer, ":")
			if len(parts) >= 2 {
				entry.Fields["peer_ip"] = parts[0]
				entry.Fields["peer_port"] = parts[1]
			}
		}
		if ident, ok := entry.Fields["peer_ident"].(string); ok {
			entry.Fields["peer_ident"] = ident
		}

	case "vpn_ike_established", "vpn_child_established", "vpn_ike_deleted", "vpn_child_closed":
		entry.EventCategory = "VPN"
		// Extract VPN peer info
		if match := regexp.MustCompile(`<([^|>]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["vpn_peer"] = match[1]
		}
		if match := regexp.MustCompile(`between\s+([^\s]+)\[([^\]]+)\].*\.\.\.([^\s]+)\[([^\]]+)\]`).FindStringSubmatch(rawMessage); len(match) > 4 {
			entry.Fields["local_ip"] = match[2]
			entry.Fields["remote_ip"] = match[4]
		}
		if match := regexp.MustCompile(`SPIs\s+([a-f0-9]+)\(inbound\)\s+([a-f0-9]+)\(outbound\)`).FindStringSubmatch(rawMessage); len(match) > 2 {
			entry.Fields["spi_inbound"] = match[1]
			entry.Fields["spi_outbound"] = match[2]
		}
		if match := regexp.MustCompile(`TS\s+([^\s]+)\s+===\s+([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 2 {
			entry.Fields["local_network"] = match[1]
			entry.Fields["remote_network"] = match[2]
		}
		if match := regexp.MustCompile(`spi=([a-f0-9]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["spi"] = match[1]
		}

	case "vpn_phase1_initiate", "vpn_phase2_failed", "vpn_ipsec_queued":
		entry.EventCategory = "VPN"
		if match := regexp.MustCompile(`for\s+([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["target_ip"] = match[1]
		}
		if match := regexp.MustCompile(`([\d\.]+)\[(\d+)\].*<=>.*([\d\.]+)\[(\d+)\]`).FindStringSubmatch(rawMessage); len(match) > 4 {
			entry.Fields["local_ip"] = match[1]
			entry.Fields["local_port"] = match[2]
			entry.Fields["remote_ip"] = match[3]
			entry.Fields["remote_port"] = match[4]
		}

	case "vpn_isakmp_purge":
		entry.EventCategory = "VPN"
		if match := regexp.MustCompile(`spi=([a-f0-9:]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["spi"] = match[1]
		}

	case "anyconnect_auth_success", "anyconnect_auth_failure", "anyconnect_connect", "anyconnect_disconnect", "anyconnect_session":
		entry.EventCategory = "VPN"
		if match := regexp.MustCompile(`Peer IP=([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["peer_ip"] = match[1]
		}
		if match := regexp.MustCompile(`Peer port=(\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["peer_port"] = match[1]
		}
		if match := regexp.MustCompile(`User\[([^\]]+)\]`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["user"] = match[1]
		}
		if match := regexp.MustCompile(`user id '([^']+)'`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["user"] = match[1]
		}
		if match := regexp.MustCompile(`local ip ([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["local_ip"] = match[1]
		}
		if match := regexp.MustCompile(`connected from ([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["remote_ip"] = match[1]
		}
		if match := regexp.MustCompile(`Sess-ID\[(\d+)\]`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["session_id"] = match[1]
		}
		if match := regexp.MustCompile(`Session Type:\s+(\w+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["session_type"] = match[1]
		}

	case "uplink_connectivity":
		entry.EventCategory = "Network"
		if strings.Contains(rawMessage, "Cellular") {
			entry.Fields["uplink_type"] = "Cellular"
			if strings.Contains(rawMessage, "down") {
				entry.Fields["status"] = "down"
			} else if strings.Contains(rawMessage, "up") {
				entry.Fields["status"] = "up"
			}
		}
		if match := regexp.MustCompile(`failover to (\w+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["failover_to"] = match[1]
		}

	case "dhcp_lease":
		entry.EventCategory = "Network"
		if match := regexp.MustCompile(`ip ([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["leased_ip"] = match[1]
		}
		if match := regexp.MustCompile(`server mac ([A-F0-9:]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["server_mac"] = match[1]
		}
		if match := regexp.MustCompile(`client mac ([A-F0-9:]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["client_mac"] = match[1]
		}
		if match := regexp.MustCompile(`from router ([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["router_ip"] = match[1]
		}
		if match := regexp.MustCompile(`subnet ([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["subnet"] = match[1]
		}
		if match := regexp.MustCompile(`dns ([\d\.,\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["dns_servers"] = strings.TrimSpace(match[1])
		}

	case "dhcp_no_offers":
		entry.EventCategory = "Network"
		if match := regexp.MustCompile(`mac ([A-F0-9:]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["client_mac"] = match[1]
		}
		if match := regexp.MustCompile(`host = ([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["host"] = match[1]
		}

	case "dhcp_blocked":
		entry.EventCategory = "Security"
		if match := regexp.MustCompile(`from ([A-F0-9:]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["server_mac"] = match[1]
		}
		if match := regexp.MustCompile(`on VLAN (\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["vlan"] = match[1]
		}

	case "firewall", "flows", "cellular_firewall", "vpn_firewall":
		entry.EventCategory = "Firewall"
		if src, ok := entry.Fields["src"].(string); ok {
			parts := strings.Split(src, ":")
			if len(parts) >= 2 {
				entry.Fields["source_ip"] = parts[0]
				entry.Fields["source_port"] = parts[1]
			} else {
				entry.Fields["source_ip"] = src
			}
		}
		if dst, ok := entry.Fields["dst"].(string); ok {
			parts := strings.Split(dst, ":")
			if len(parts) >= 2 {
				entry.Fields["dest_ip"] = parts[0]
				entry.Fields["dest_port"] = parts[1]
			} else {
				entry.Fields["dest_ip"] = dst
			}
		}
		if mac, ok := entry.Fields["mac"].(string); ok {
			entry.Fields["mac_address"] = mac
		}
		if protocol, ok := entry.Fields["protocol"].(string); ok {
			entry.Fields["protocol"] = protocol
		}
		if sport, ok := entry.Fields["sport"].(string); ok {
			entry.Fields["source_port"] = sport
		}
		if dport, ok := entry.Fields["dport"].(string); ok {
			entry.Fields["dest_port"] = dport
		}
		if pattern, ok := entry.Fields["pattern"].(string); ok {
			entry.Fields["rule_pattern"] = pattern
		}
		// Check for allow/deny
		if strings.Contains(rawMessage, " allow ") {
			entry.Fields["action"] = "allow"
		} else if strings.Contains(rawMessage, " deny ") {
			entry.Fields["action"] = "deny"
		}

	case "ids_alert", "security_file_scanned", "security_disposition":
		entry.EventCategory = "Security"
		if sig, ok := entry.Fields["signature"].(string); ok {
			entry.Fields["signature_id"] = sig
		}
		if priority, ok := entry.Fields["priority"].(string); ok {
			entry.Fields["alert_priority"] = priority
		}
		if direction, ok := entry.Fields["direction"].(string); ok {
			entry.Fields["direction"] = direction
		}
		if src, ok := entry.Fields["src"].(string); ok {
			parts := strings.Split(src, ":")
			entry.Fields["source_ip"] = parts[0]
			if len(parts) > 1 {
				entry.Fields["source_port"] = parts[1]
			}
		}
		if dst, ok := entry.Fields["dst"].(string); ok {
			entry.Fields["dest_ip"] = dst
		}
		if dhost, ok := entry.Fields["dhost"].(string); ok {
			entry.Fields["dest_mac"] = dhost
		}
		if decision, ok := entry.Fields["decision"].(string); ok {
			entry.Fields["decision"] = decision
		}
		if action, ok := entry.Fields["action"].(string); ok {
			entry.Fields["action"] = action
		}
		if message, ok := entry.Fields["message"].(string); ok {
			entry.Fields["alert_message"] = message
		}
		if url, ok := entry.Fields["url"].(string); ok {
			entry.Fields["url"] = url
		}
		if name, ok := entry.Fields["name"].(string); ok {
			entry.Fields["file_name"] = name
		}
		if sha256, ok := entry.Fields["sha256"].(string); ok {
			entry.Fields["file_sha256"] = sha256
		}
		if disposition, ok := entry.Fields["disposition"].(string); ok {
			entry.Fields["file_disposition"] = disposition
		}

	case "urls":
		entry.EventCategory = "Web"
		if request, ok := entry.Fields["request"].(string); ok {
			if strings.HasPrefix(request, "GET ") {
				entry.Fields["method"] = "GET"
				entry.Fields["url"] = strings.TrimPrefix(request, "GET ")
			} else if strings.HasPrefix(request, "POST ") {
				entry.Fields["method"] = "POST"
				entry.Fields["url"] = strings.TrimPrefix(request, "POST ")
			} else if strings.HasPrefix(request, "UNKNOWN ") {
				entry.Fields["method"] = "UNKNOWN"
				entry.Fields["url"] = strings.TrimPrefix(request, "UNKNOWN ")
			}
		}
		if src, ok := entry.Fields["src"].(string); ok {
			parts := strings.Split(src, ":")
			entry.Fields["source_ip"] = parts[0]
			if len(parts) > 1 {
				entry.Fields["source_port"] = parts[1]
			}
		}
		if dst, ok := entry.Fields["dst"].(string); ok {
			parts := strings.Split(dst, ":")
			entry.Fields["dest_ip"] = parts[0]
			if len(parts) > 1 {
				entry.Fields["dest_port"] = parts[1]
			}
		}
		if mac, ok := entry.Fields["mac"].(string); ok {
			entry.Fields["mac_address"] = mac
		}

	case "port_status":
		entry.EventCategory = "Network"
		if match := regexp.MustCompile(`port (\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["port_number"] = match[1]
		}
		if match := regexp.MustCompile(`from (\w+) to (\w+)`).FindStringSubmatch(rawMessage); len(match) > 2 {
			entry.Fields["old_status"] = match[1]
			entry.Fields["new_status"] = match[2]
		}

	case "stp_guard":
		entry.EventCategory = "Network"
		if match := regexp.MustCompile(`Port (\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["port_number"] = match[1]
		}
		if match := regexp.MustCompile(`from ([A-F0-9:]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["source_mac"] = match[1]
		}

	case "stp_role_change":
		entry.EventCategory = "Network"
		if match := regexp.MustCompile(`Port (\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["port_number"] = match[1]
		}
		if match := regexp.MustCompile(`from (\w+) to (\w+)`).FindStringSubmatch(rawMessage); len(match) > 2 {
			entry.Fields["old_role"] = match[1]
			entry.Fields["new_role"] = match[2]
		}

	case "8021x_auth", "8021x_deauth", "8021x_failure":
		entry.EventCategory = "Authentication"
		if identity, ok := entry.Fields["identity"].(string); ok {
			entry.Fields["user"] = identity
		}
		if port, ok := entry.Fields["port"].(string); ok {
			entry.Fields["port_number"] = port
		}

	case "vrrp_collision":
		entry.EventCategory = "Network"
		if match := regexp.MustCompile(`virtual router (\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["vrrp_group"] = match[1]
		}
		if match := regexp.MustCompile(`from ([\d\.]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["source_ip"] = match[1]
		}
		if match := regexp.MustCompile(`on VLAN (\w+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["vlan"] = match[1]
		}

	case "vrrp_transition":
		entry.EventCategory = "Network"
		if match := regexp.MustCompile(`from VRRP (\w+) to VRRP (\w+)`).FindStringSubmatch(rawMessage); len(match) > 2 {
			entry.Fields["old_state"] = match[1]
			entry.Fields["new_state"] = match[2]
		}

	case "power_supply":
		entry.EventCategory = "Hardware"
		if match := regexp.MustCompile(`Power supply ([^\s]+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["power_supply_id"] = match[1]
		}
		if match := regexp.MustCompile(`slot (\d+)`).FindStringSubmatch(rawMessage); len(match) > 1 {
			entry.Fields["slot"] = match[1]
		}

	case "association", "disassociation":
		entry.EventCategory = "Wireless"
		if radio, ok := entry.Fields["radio"].(string); ok {
			entry.Fields["radio"] = radio
		}
		if vap, ok := entry.Fields["vap"].(string); ok {
			entry.Fields["vap"] = vap
		}
		if channel, ok := entry.Fields["channel"].(string); ok {
			entry.Fields["channel"] = channel
		}
		if rssi, ok := entry.Fields["rssi"].(string); ok {
			entry.Fields["rssi"] = rssi
		}
		if aid, ok := entry.Fields["aid"].(string); ok {
			entry.Fields["association_id"] = aid
		}
		if reason, ok := entry.Fields["reason"].(string); ok {
			entry.Fields["disconnect_reason"] = reason
		}
		if instigator, ok := entry.Fields["instigator"].(string); ok {
			entry.Fields["instigator"] = instigator
		}
		if duration, ok := entry.Fields["duration"].(string); ok {
			entry.Fields["session_duration"] = duration
		}
		if ipSrc, ok := entry.Fields["ip_src"].(string); ok {
			entry.Fields["client_ip"] = ipSrc
		}
		if dnsServer, ok := entry.Fields["dns_server"].(string); ok {
			entry.Fields["dns_server"] = dnsServer
		}

	case "wpa_auth", "wpa_deauth", "wpa_failed":
		entry.EventCategory = "Wireless"
		if radio, ok := entry.Fields["radio"].(string); ok {
			entry.Fields["radio"] = radio
		}
		if vap, ok := entry.Fields["vap"].(string); ok {
			entry.Fields["vap"] = vap
		}
		if aid, ok := entry.Fields["aid"].(string); ok {
			entry.Fields["association_id"] = aid
		}

	case "splash_auth":
		entry.EventCategory = "Wireless"
		if ip, ok := entry.Fields["ip"].(string); ok {
			entry.Fields["client_ip"] = ip
		}
		if duration, ok := entry.Fields["duration"].(string); ok {
			entry.Fields["session_duration"] = duration
		}
		if vap, ok := entry.Fields["vap"].(string); ok {
			entry.Fields["vap"] = vap
		}
		if download, ok := entry.Fields["download"].(string); ok {
			entry.Fields["download_limit"] = download
		}
		if upload, ok := entry.Fields["upload"].(string); ok {
			entry.Fields["upload_limit"] = upload
		}

	case "packet_flood":
		entry.EventCategory = "Security"
		if packet, ok := entry.Fields["packet"].(string); ok {
			entry.Fields["flood_type"] = packet
		}
		if device, ok := entry.Fields["device"].(string); ok {
			entry.Fields["source_device"] = device
		}
		if radio, ok := entry.Fields["radio"].(string); ok {
			entry.Fields["radio"] = radio
		}
		if state, ok := entry.Fields["state"].(string); ok {
			entry.Fields["flood_state"] = state
		}
		if alarmId, ok := entry.Fields["alarm_id"].(string); ok {
			entry.Fields["alarm_id"] = alarmId
		}
		if dosCount, ok := entry.Fields["dos_count"].(string); ok {
			entry.Fields["packet_count"] = dosCount
		}
		if reason, ok := entry.Fields["reason"].(string); ok {
			entry.Fields["end_reason"] = reason
		}

	case "rogue_ssid", "ssid_spoofing":
		entry.EventCategory = "Security"
		if ssid, ok := entry.Fields["ssid"].(string); ok {
			entry.Fields["ssid"] = ssid
		}
		if bssid, ok := entry.Fields["bssid"].(string); ok {
			entry.Fields["bssid"] = bssid
		}
		if channel, ok := entry.Fields["channel"].(string); ok {
			entry.Fields["channel"] = channel
		}
		if rssi, ok := entry.Fields["rssi"].(string); ok {
			entry.Fields["rssi"] = rssi
		}
		if vap, ok := entry.Fields["vap"].(string); ok {
			entry.Fields["vap"] = vap
		}
	}

	return entry
}

// GetDisplayInfo returns UI display information - this is a large function that handles all event types
func (m *MerakiModule) GetDisplayInfo(entry *ParsedLog) *DisplayInfo {
	info := &DisplayInfo{
		Details:  []DetailItem{},
		Badges:   []Badge{},
		Actions:  []Action{},
		Metadata: make(map[string]string),
	}

	switch entry.EventType {
	case "vpn_connectivity_change":
		info.Icon = "🔐"
		info.Color = "#6366f1"
		info.Title = "VPN Connectivity Change"
		if connectivity, ok := entry.Fields["connectivity"].(string); ok {
			if connectivity == "true" {
				info.Description = "VPN connection established"
				info.Color = "#10b981"
				info.Badges = append(info.Badges, Badge{Label: "Status", Color: "#10b981", Value: "Connected"})
			} else {
				info.Description = "VPN connection lost"
				info.Color = "#ef4444"
				info.Badges = append(info.Badges, Badge{Label: "Status", Color: "#ef4444", Value: "Disconnected"})
			}
		}
		if peerIP, ok := entry.Fields["peer_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Peer IP", Value: peerIP, Type: "ip"})
		}
		if vpnType, ok := entry.Fields["vpn_type"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "VPN Type", Value: vpnType, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Type", Color: "#6366f1", Value: vpnType})
		}
		if peerIdent, ok := entry.Fields["peer_ident"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Peer Identity", Value: peerIdent, Type: "text"})
		}
		info.Visualization = "vpn_tunnel"

	case "vpn_ike_established":
		info.Icon = "🔐"
		info.Color = "#10b981"
		info.Title = "VPN Phase 1 Established"
		info.Description = "IKE_SA tunnel established"
		info.Badges = append(info.Badges, Badge{Label: "Phase", Color: "#10b981", Value: "Phase 1"})
		if localIP, ok := entry.Fields["local_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Local IP", Value: localIP, Type: "ip"})
		}
		if remoteIP, ok := entry.Fields["remote_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Remote IP", Value: remoteIP, Type: "ip"})
		}
		if peer, ok := entry.Fields["vpn_peer"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "VPN Peer", Value: peer, Type: "text"})
		}
		info.Visualization = "vpn_tunnel"

	case "vpn_child_established":
		info.Icon = "🔐"
		info.Color = "#10b981"
		info.Title = "VPN Phase 2 Established"
		info.Description = "CHILD_SA tunnel established"
		info.Badges = append(info.Badges, Badge{Label: "Phase", Color: "#10b981", Value: "Phase 2"})
		if localNetwork, ok := entry.Fields["local_network"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Local Network", Value: localNetwork, Type: "text"})
		}
		if remoteNetwork, ok := entry.Fields["remote_network"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Remote Network", Value: remoteNetwork, Type: "text"})
		}
		if spiIn, ok := entry.Fields["spi_inbound"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "SPI Inbound", Value: spiIn, Type: "text"})
		}
		if spiOut, ok := entry.Fields["spi_outbound"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "SPI Outbound", Value: spiOut, Type: "text"})
		}
		info.Visualization = "vpn_tunnel"

	case "vpn_ike_deleted", "vpn_child_closed":
		info.Icon = "🔓"
		info.Color = "#ef4444"
		info.Title = "VPN Tunnel Closed"
		if entry.EventType == "vpn_ike_deleted" {
			info.Description = "IKE_SA tunnel deleted"
			info.Badges = append(info.Badges, Badge{Label: "Phase", Color: "#ef4444", Value: "Phase 1"})
		} else {
			info.Description = "CHILD_SA tunnel closed"
			info.Badges = append(info.Badges, Badge{Label: "Phase", Color: "#ef4444", Value: "Phase 2"})
		}
		if localIP, ok := entry.Fields["local_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Local IP", Value: localIP, Type: "ip"})
		}
		if remoteIP, ok := entry.Fields["remote_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Remote IP", Value: remoteIP, Type: "ip"})
		}
		info.Visualization = "vpn_tunnel"

	case "vpn_phase1_initiate", "vpn_phase2_failed", "vpn_ipsec_queued", "vpn_isakmp_purge":
		info.Icon = "🔄"
		info.Color = "#f59e0b"
		if entry.EventType == "vpn_phase1_initiate" {
			info.Title = "VPN Phase 1 Initiated"
			info.Description = "Initiating Phase 1 negotiation"
		} else if entry.EventType == "vpn_phase2_failed" {
			info.Title = "VPN Phase 2 Failed"
			info.Description = "Phase 2 negotiation failed"
			info.Color = "#ef4444"
		} else if entry.EventType == "vpn_ipsec_queued" {
			info.Title = "IPsec-SA Queued"
			info.Description = "Waiting for Phase 1"
		} else {
			info.Title = "ISAKMP-SA Purged"
			info.Description = "Purging ISAKMP security association"
		}
		if targetIP, ok := entry.Fields["target_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Target IP", Value: targetIP, Type: "ip"})
		}
		if localIP, ok := entry.Fields["local_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Local IP", Value: localIP, Type: "ip"})
		}
		if remoteIP, ok := entry.Fields["remote_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Remote IP", Value: remoteIP, Type: "ip"})
		}

	case "anyconnect_start":
		info.Icon = "🚀"
		info.Color = "#10b981"
		info.Title = "AnyConnect Server Started"
		info.Description = "AnyConnect VPN server is now running"

	case "anyconnect_auth_success":
		info.Icon = "✅"
		info.Color = "#10b981"
		info.Title = "AnyConnect Authentication Success"
		info.Description = "User successfully authenticated"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
		}
		if peerIP, ok := entry.Fields["peer_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Peer IP", Value: peerIP, Type: "ip"})
		}

	case "anyconnect_auth_failure":
		info.Icon = "❌"
		info.Color = "#ef4444"
		info.Title = "AnyConnect Authentication Failure"
		info.Description = "Authentication failed"
		if peerIP, ok := entry.Fields["peer_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Peer IP", Value: peerIP, Type: "ip"})
		}

	case "anyconnect_connect":
		info.Icon = "🔗"
		info.Color = "#10b981"
		info.Title = "AnyConnect VPN Connected"
		info.Description = "User connected to AnyConnect VPN"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "User", Color: "#6366f1", Value: user})
		}
		if localIP, ok := entry.Fields["local_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Assigned IP", Value: localIP, Type: "ip"})
		}
		if remoteIP, ok := entry.Fields["remote_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Connected From", Value: remoteIP, Type: "ip"})
		}

	case "anyconnect_disconnect":
		info.Icon = "🔌"
		info.Color = "#ef4444"
		info.Title = "AnyConnect VPN Disconnected"
		info.Description = "User disconnected from AnyConnect VPN"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
		}
		if localIP, ok := entry.Fields["local_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Assigned IP", Value: localIP, Type: "ip"})
		}

	case "anyconnect_session":
		info.Icon = "👤"
		info.Color = "#6366f1"
		info.Title = "AnyConnect Session Event"
		info.Description = "Session manager event"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
		}
		if sessionID, ok := entry.Fields["session_id"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Session ID", Value: sessionID, Type: "text"})
		}
		if sessionType, ok := entry.Fields["session_type"].(string); ok {
			info.Badges = append(info.Badges, Badge{Label: "Type", Color: "#6366f1", Value: sessionType})
		}

	case "uplink_connectivity":
		info.Icon = "📡"
		info.Color = "#6366f1"
		info.Title = "Uplink Connectivity Change"
		if uplinkType, ok := entry.Fields["uplink_type"].(string); ok {
			info.Description = uplinkType + " connection status changed"
			info.Badges = append(info.Badges, Badge{Label: "Uplink", Color: "#6366f1", Value: uplinkType})
		}
		if status, ok := entry.Fields["status"].(string); ok {
			if status == "up" {
				info.Color = "#10b981"
				info.Badges = append(info.Badges, Badge{Label: "Status", Color: "#10b981", Value: "Up"})
			} else {
				info.Color = "#ef4444"
				info.Badges = append(info.Badges, Badge{Label: "Status", Color: "#ef4444", Value: "Down"})
			}
		}
		if failoverTo, ok := entry.Fields["failover_to"].(string); ok {
			info.Description = "Failover to " + failoverTo
			info.Badges = append(info.Badges, Badge{Label: "Failover", Color: "#f59e0b", Value: failoverTo})
		}
		info.Visualization = "network_topology"

	case "dhcp_lease":
		info.Icon = "🌐"
		info.Color = "#10b981"
		info.Title = "DHCP Lease Assigned"
		info.Description = "DHCP lease granted to client"
		if leasedIP, ok := entry.Fields["leased_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Leased IP", Value: leasedIP, Type: "ip"})
			info.Badges = append(info.Badges, Badge{Label: "IP", Color: "#10b981", Value: leasedIP})
		}
		if clientMac, ok := entry.Fields["client_mac"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Client MAC", Value: clientMac, Type: "mac"})
		}
		if serverMac, ok := entry.Fields["server_mac"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Server MAC", Value: serverMac, Type: "mac"})
		}
		if routerIP, ok := entry.Fields["router_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Router", Value: routerIP, Type: "ip"})
		}
		if subnet, ok := entry.Fields["subnet"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Subnet", Value: subnet, Type: "text"})
		}
		if dnsServers, ok := entry.Fields["dns_servers"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "DNS Servers", Value: dnsServers, Type: "text"})
		}

	case "dhcp_no_offers":
		info.Icon = "⚠️"
		info.Color = "#f59e0b"
		info.Title = "DHCP No Offers"
		info.Description = "No DHCP offers received"
		if clientMac, ok := entry.Fields["client_mac"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Client MAC", Value: clientMac, Type: "mac"})
		}
		if host, ok := entry.Fields["host"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Host", Value: host, Type: "ip"})
		}

	case "dhcp_blocked":
		info.Icon = "🚫"
		info.Color = "#ef4444"
		info.Title = "DHCP Server Blocked"
		info.Description = "Unauthorized DHCP server response blocked"
		if serverMac, ok := entry.Fields["server_mac"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Blocked MAC", Value: serverMac, Type: "mac"})
		}
		if vlan, ok := entry.Fields["vlan"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "VLAN", Value: vlan, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "VLAN", Color: "#8b5cf6", Value: vlan})
		}

	case "firewall", "flows", "cellular_firewall", "vpn_firewall":
		info.Icon = "🔥"
		info.Color = "#f59e0b"
		info.Title = "Firewall Rule Matched"

		// Determine firewall type
		if entry.EventType == "cellular_firewall" {
			info.Badges = append(info.Badges, Badge{Label: "Type", Color: "#3b82f6", Value: "Cellular"})
		} else if entry.EventType == "vpn_firewall" {
			info.Badges = append(info.Badges, Badge{Label: "Type", Color: "#6366f1", Value: "VPN"})
		}

		if action, ok := entry.Fields["action"].(string); ok {
			if action == "allow" {
				info.Color = "#10b981"
				info.Description = "Traffic allowed by firewall rule"
				info.Badges = append(info.Badges, Badge{Label: "Action", Color: "#10b981", Value: "Allow"})
			} else {
				info.Color = "#ef4444"
				info.Description = "Traffic denied by firewall rule"
				info.Badges = append(info.Badges, Badge{Label: "Action", Color: "#ef4444", Value: "Deny"})
			}
		}
		if rule, ok := entry.Fields["rule_pattern"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Rule Pattern", Value: rule, Type: "text"})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}
		if dstIP, ok := entry.Fields["dest_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination IP", Value: dstIP, Type: "ip"})
		}
		if protocol, ok := entry.Fields["protocol"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Protocol", Value: strings.ToUpper(protocol), Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Protocol", Color: "#3b82f6", Value: strings.ToUpper(protocol)})
		}
		if sport, ok := entry.Fields["source_port"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source Port", Value: sport, Type: "text"})
		}
		if dport, ok := entry.Fields["dest_port"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination Port", Value: dport, Type: "text"})
			// Add common port service identification
			portServices := map[string]string{
				"80": "HTTP", "443": "HTTPS", "22": "SSH", "23": "Telnet",
				"25": "SMTP", "53": "DNS", "21": "FTP", "3389": "RDP",
			}
			if service, ok := portServices[dport]; ok {
				info.Badges = append(info.Badges, Badge{Label: "Service", Color: "#8b5cf6", Value: service})
			}
		}
		if mac, ok := entry.Fields["mac_address"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Device MAC", Value: mac, Type: "mac"})
		}
		info.Visualization = "flow"
		info.Actions = append(info.Actions, Action{Label: "View Firewall Rule", Type: "view_rule", URL: "#"})
		info.Actions = append(info.Actions, Action{Label: "Block Source IP", Type: "block_ip", URL: "#"})

	case "ids_alert":
		info.Icon = "🛡️"
		info.Color = "#ef4444"
		info.Title = "IDS Alert"
		if sig, ok := entry.Fields["signature_id"].(string); ok {
			info.Description = "Intrusion Detection System signature matched"
			sigParts := strings.Split(sig, ":")
			if len(sigParts) > 0 {
				sigURL := "https://www.snort.org/rule_docs?sid=" + sigParts[0]
				info.Details = append(info.Details, DetailItem{
					Label: "Signature ID",
					Value: sig,
					Type:  "signature",
					Link:  sigURL,
				})
				info.Actions = append(info.Actions, Action{Label: "View Signature Details", Type: "link", URL: sigURL})
			}
		}
		if priority, ok := entry.Fields["alert_priority"].(string); ok {
			priorityInt, _ := strconv.Atoi(priority)
			priorityColors := map[int]string{1: "#ef4444", 2: "#f59e0b", 3: "#eab308", 4: "#84cc16"}
			priorityLabels := map[int]string{1: "High", 2: "Medium", 3: "Low", 4: "Very Low"}
			if color, ok := priorityColors[priorityInt]; ok {
				info.Badges = append(info.Badges, Badge{
					Label: "Threat Level",
					Color: color,
					Value: priorityLabels[priorityInt],
				})
			}
		}
		if direction, ok := entry.Fields["direction"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Traffic Direction", Value: direction, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Direction", Color: "#6366f1", Value: direction})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}
		if srcPort, ok := entry.Fields["source_port"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source Port", Value: srcPort, Type: "text"})
		}
		if dstIP, ok := entry.Fields["dest_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination IP", Value: dstIP, Type: "ip"})
		}
		if dstPort, ok := entry.Fields["dest_port"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination Port", Value: dstPort, Type: "text"})
		}
		if protocol, ok := entry.Fields["protocol"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Protocol", Value: protocol, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Protocol", Color: "#3b82f6", Value: strings.ToUpper(protocol)})
		}
		if decision, ok := entry.Fields["decision"].(string); ok {
			decisionColor := "#10b981"
			if decision == "blocked" {
				decisionColor = "#ef4444"
			}
			info.Badges = append(info.Badges, Badge{Label: "Action", Color: decisionColor, Value: strings.ToUpper(decision)})
		}
		if alertMsg, ok := entry.Fields["alert_message"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Alert Description", Value: alertMsg, Type: "text"})
		}
		if destMac, ok := entry.Fields["dest_mac"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Target MAC", Value: destMac, Type: "mac"})
		}
		info.Visualization = "security_alert"
		info.Actions = append(info.Actions, Action{Label: "Search Similar Alerts", Type: "search", URL: "#"})

	case "security_file_scanned":
		info.Icon = "🦠"
		info.Color = "#ef4444"
		info.Title = "Malicious File Blocked"
		info.Description = "File blocked by AMP (Advanced Malware Protection)"
		if fileName, ok := entry.Fields["file_name"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Threat Name", Value: fileName, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Threat", Color: "#ef4444", Value: "Malicious"})
		}
		if sha256, ok := entry.Fields["file_sha256"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "File SHA256", Value: sha256, Type: "text"})
			// Add VirusTotal lookup action
			info.Actions = append(info.Actions, Action{
				Label: "View on VirusTotal",
				Type:  "link",
				URL:   "https://www.virustotal.com/gui/file/" + sha256,
			})
		}
		if url, ok := entry.Fields["url"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source URL", Value: url, Type: "url", Link: url})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}
		if dstIP, ok := entry.Fields["dest_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination IP", Value: dstIP, Type: "ip"})
		}
		if mac, ok := entry.Fields["mac_address"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Device MAC", Value: mac, Type: "mac"})
		}
		if disposition, ok := entry.Fields["file_disposition"].(string); ok {
			info.Badges = append(info.Badges, Badge{Label: "Disposition", Color: "#ef4444", Value: disposition})
		}
		if action, ok := entry.Fields["action"].(string); ok {
			actionColor := "#10b981"
			if action == "block" {
				actionColor = "#ef4444"
			}
			info.Badges = append(info.Badges, Badge{Label: "Action Taken", Color: actionColor, Value: strings.ToUpper(action)})
		}
		info.Visualization = "security_threat"
		info.Actions = append(info.Actions, Action{Label: "Block Source IP", Type: "block_ip", URL: "#"})

	case "security_disposition":
		info.Icon = "🔄"
		info.Color = "#f59e0b"
		info.Title = "File Disposition Changed"
		info.Description = "Retrospective malicious disposition"
		if fileName, ok := entry.Fields["file_name"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "File Name", Value: fileName, Type: "text"})
		}
		if sha256, ok := entry.Fields["file_sha256"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "SHA256", Value: sha256, Type: "text"})
		}
		if disposition, ok := entry.Fields["file_disposition"].(string); ok {
			info.Badges = append(info.Badges, Badge{Label: "Disposition", Color: "#ef4444", Value: disposition})
		}

	case "urls":
		info.Icon = "🌐"
		info.Color = "#3b82f6"
		info.Title = "HTTP Request"
		if url, ok := entry.Fields["url"].(string); ok {
			info.Description = url
			info.Details = append(info.Details, DetailItem{Label: "URL", Value: url, Type: "url", Link: url})
		}
		if method, ok := entry.Fields["method"].(string); ok {
			info.Badges = append(info.Badges, Badge{Label: "Method", Color: "#6366f1", Value: method})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source", Value: srcIP, Type: "ip"})
		}
		if dstIP, ok := entry.Fields["dest_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Destination", Value: dstIP, Type: "ip"})
		}
		if mac, ok := entry.Fields["mac_address"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "MAC Address", Value: mac, Type: "mac"})
		}

	case "port_status":
		info.Icon = "🔌"
		info.Color = "#8b5cf6"
		info.Title = "Port Status Change"
		if port, ok := entry.Fields["port_number"].(string); ok {
			info.Description = "Port " + port + " status changed"
			info.Badges = append(info.Badges, Badge{Label: "Port", Color: "#8b5cf6", Value: port})
		}
		if oldStatus, ok := entry.Fields["old_status"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Previous", Value: oldStatus, Type: "text"})
		}
		if newStatus, ok := entry.Fields["new_status"].(string); ok {
			color := "#10b981"
			if newStatus == "down" {
				color = "#ef4444"
			}
			info.Details = append(info.Details, DetailItem{Label: "Current", Value: newStatus, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Status", Color: color, Value: newStatus})
		}
		info.Visualization = "port_status"

	case "stp_guard":
		info.Icon = "🛡️"
		info.Color = "#ef4444"
		info.Title = "STP Guard Triggered"
		info.Description = "Port blocked due to STP BPDU"
		if port, ok := entry.Fields["port_number"].(string); ok {
			info.Badges = append(info.Badges, Badge{Label: "Port", Color: "#8b5cf6", Value: port})
		}
		if srcMac, ok := entry.Fields["source_mac"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source MAC", Value: srcMac, Type: "mac"})
		}

	case "stp_role_change":
		info.Icon = "🔄"
		info.Color = "#6366f1"
		info.Title = "STP Role Change"
		if port, ok := entry.Fields["port_number"].(string); ok {
			info.Description = "Port " + port + " STP role changed"
			info.Badges = append(info.Badges, Badge{Label: "Port", Color: "#8b5cf6", Value: port})
		}
		if oldRole, ok := entry.Fields["old_role"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Previous Role", Value: oldRole, Type: "text"})
		}
		if newRole, ok := entry.Fields["new_role"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "New Role", Value: newRole, Type: "text"})
			roleColors := map[string]string{"root": "#10b981", "designated": "#6366f1", "alternate": "#f59e0b", "disabled": "#9ca3af"}
			if color, ok := roleColors[strings.ToLower(newRole)]; ok {
				info.Badges = append(info.Badges, Badge{Label: "Role", Color: color, Value: newRole})
			}
		}

	case "8021x_auth":
		info.Icon = "🔑"
		info.Color = "#10b981"
		info.Title = "802.1X Authentication"
		info.Description = "User authenticated via 802.1X"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "User", Color: "#6366f1", Value: user})
		}
		if port, ok := entry.Fields["port_number"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Port", Value: port, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Port", Color: "#8b5cf6", Value: port})
		}
		info.Badges = append(info.Badges, Badge{Label: "Type", Color: "#6366f1", Value: "802.1X"})

	case "8021x_deauth":
		info.Icon = "🔓"
		info.Color = "#ef4444"
		info.Title = "802.1X Deauthentication"
		info.Description = "User deauthenticated"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
		}
		if port, ok := entry.Fields["port_number"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Port", Value: port, Type: "text"})
		}

	case "8021x_failure":
		info.Icon = "❌"
		info.Color = "#ef4444"
		info.Title = "802.1X Authentication Failure"
		info.Description = "Authentication failed"
		if user, ok := entry.Fields["user"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "User", Value: user, Type: "text"})
		}

	case "vrrp_collision":
		info.Icon = "⚠️"
		info.Color = "#f59e0b"
		info.Title = "VRRP Collision"
		info.Description = "VRRP packet with incompatible configuration"
		if vrrpGroup, ok := entry.Fields["vrrp_group"].(string); ok {
			info.Badges = append(info.Badges, Badge{Label: "VRRP Group", Color: "#f59e0b", Value: vrrpGroup})
		}
		if srcIP, ok := entry.Fields["source_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source IP", Value: srcIP, Type: "ip"})
		}
		if vlan, ok := entry.Fields["vlan"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "VLAN", Value: vlan, Type: "text"})
		}

	case "vrrp_transition":
		info.Icon = "🔄"
		info.Color = "#6366f1"
		info.Title = "VRRP Transition"
		if oldState, ok := entry.Fields["old_state"].(string); ok {
			info.Description = "Changed from " + oldState + " to active"
		}
		if newState, ok := entry.Fields["new_state"].(string); ok {
			info.Badges = append(info.Badges, Badge{Label: "State", Color: "#10b981", Value: newState})
		}

	case "power_supply":
		info.Icon = "⚡"
		info.Color = "#10b981"
		info.Title = "Power Supply Inserted"
		info.Description = "Power supply inserted into slot"
		if powerSupplyID, ok := entry.Fields["power_supply_id"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Power Supply ID", Value: powerSupplyID, Type: "text"})
		}
		if slot, ok := entry.Fields["slot"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Slot", Value: slot, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Slot", Color: "#10b981", Value: slot})
		}

	case "association":
		info.Icon = "📶"
		info.Color = "#10b981"
		info.Title = "Wireless Client Association"
		info.Description = "New client connected to wireless network"
		if channel, ok := entry.Fields["channel"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Channel", Value: channel, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Channel", Color: "#8b5cf6", Value: channel})
		}
		if radio, ok := entry.Fields["radio"].(string); ok {
			radioBand := "2.4 GHz"
			if radio == "1" {
				radioBand = "5 GHz"
			}
			info.Details = append(info.Details, DetailItem{Label: "Radio Band", Value: radioBand, Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "Band", Color: "#6366f1", Value: radioBand})
		}
		if rssi, ok := entry.Fields["rssi"].(string); ok {
			rssiInt, _ := strconv.Atoi(rssi)
			rssiColor := "#10b981"
			if rssiInt < -70 {
				rssiColor = "#ef4444"
			} else if rssiInt < -60 {
				rssiColor = "#f59e0b"
			}
			info.Details = append(info.Details, DetailItem{Label: "Signal Strength", Value: rssi + " dBm", Type: "text"})
			info.Badges = append(info.Badges, Badge{Label: "RSSI", Color: rssiColor, Value: rssi + " dBm"})
			if signalQuality, ok := entry.Fields["signal_quality"].(string); ok {
				qualityColor := "#10b981"
				if signalQuality == "Poor" {
					qualityColor = "#ef4444"
				} else if signalQuality == "Fair" {
					qualityColor = "#f59e0b"
				}
				info.Badges = append(info.Badges, Badge{Label: "Quality", Color: qualityColor, Value: signalQuality})
			}
		}
		if vap, ok := entry.Fields["vap"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "VAP ID", Value: vap, Type: "text"})
		}
		if clientIP, ok := entry.Fields["client_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Client IP", Value: clientIP, Type: "ip"})
		}
		if dnsServer, ok := entry.Fields["dns_server"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "DNS Server", Value: dnsServer, Type: "ip"})
		}
		if aid, ok := entry.Fields["association_id"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Association ID", Value: aid, Type: "text"})
		}
		info.Visualization = "wireless_connection"

	case "disassociation":
		info.Icon = "📡"
		info.Color = "#ef4444"
		info.Title = "Wireless Client Disassociation"
		info.Description = "Client disconnected from access point"
		if reason, ok := entry.Fields["disconnect_reason"].(string); ok {
			reasonDesc := map[string]string{
				"1": "Unspecified",
				"2": "Previous authentication no longer valid",
				"3": "Deauthenticated because sending station is leaving",
				"4": "Disassociated due to inactivity",
				"5": "Disassociated because AP is unable to handle",
				"6": "Class 2 frame received from non-authenticated station",
				"7": "Class 3 frame received from non-associated station",
				"8": "Disassociated because sending station is leaving",
			}
			if desc, ok := reasonDesc[reason]; ok {
				info.Details = append(info.Details, DetailItem{Label: "Disconnect Reason", Value: desc + " (Code: " + reason + ")", Type: "text"})
			} else {
				info.Details = append(info.Details, DetailItem{Label: "Disconnect Reason", Value: "Code: " + reason, Type: "text"})
			}
		}
		if instigator, ok := entry.Fields["instigator"].(string); ok {
			instigatorDesc := map[string]string{
				"0": "Client",
				"1": "AP",
				"2": "Unknown",
				"3": "AP (due to inactivity)",
			}
			if desc, ok := instigatorDesc[instigator]; ok {
				info.Details = append(info.Details, DetailItem{Label: "Disconnect Initiated By", Value: desc, Type: "text"})
				info.Badges = append(info.Badges, Badge{Label: "Initiated By", Color: "#6366f1", Value: desc})
			}
		}
		if duration, ok := entry.Fields["session_duration"].(string); ok {
			if durFloat, err := strconv.ParseFloat(duration, 64); err == nil {
				hours := int(durFloat / 3600)
				minutes := int((durFloat - float64(hours*3600)) / 60)
				seconds := int(durFloat) % 60
				durationStr := fmt.Sprintf("%02d:%02d:%02d", hours, minutes, seconds)
				info.Details = append(info.Details, DetailItem{Label: "Session Duration", Value: durationStr, Type: "text"})
			} else {
				info.Details = append(info.Details, DetailItem{Label: "Session Duration", Value: duration + "s", Type: "text"})
			}
		}
		if channel, ok := entry.Fields["channel"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Channel", Value: channel, Type: "text"})
		}
		if radio, ok := entry.Fields["radio"].(string); ok {
			radioBand := "2.4 GHz"
			if radio == "1" {
				radioBand = "5 GHz"
			}
			info.Details = append(info.Details, DetailItem{Label: "Radio Band", Value: radioBand, Type: "text"})
		}
		info.Visualization = "wireless_connection"

	case "wpa_auth":
		info.Icon = "🔐"
		info.Color = "#10b981"
		info.Title = "WPA Authentication"
		info.Description = "WPA authentication successful"
		if radio, ok := entry.Fields["radio"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Radio", Value: radio, Type: "text"})
		}
		if vap, ok := entry.Fields["vap"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "VAP", Value: vap, Type: "text"})
		}

	case "wpa_deauth":
		info.Icon = "🔓"
		info.Color = "#ef4444"
		info.Title = "WPA Deauthentication"
		info.Description = "WPA deauthentication"

	case "wpa_failed":
		info.Icon = "❌"
		info.Color = "#ef4444"
		info.Title = "WPA Authentication Failed"
		info.Description = "WPA authentication attempt failed"

	case "splash_auth":
		info.Icon = "🎫"
		info.Color = "#6366f1"
		info.Title = "Splash Page Authentication"
		info.Description = "User authenticated via splash page"
		if clientIP, ok := entry.Fields["client_ip"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Client IP", Value: clientIP, Type: "ip"})
		}
		if duration, ok := entry.Fields["session_duration"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Session Duration", Value: duration + "s", Type: "text"})
		}
		if download, ok := entry.Fields["download_limit"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Download Limit", Value: download, Type: "text"})
		}
		if upload, ok := entry.Fields["upload_limit"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Upload Limit", Value: upload, Type: "text"})
		}

	case "packet_flood":
		info.Icon = "🌊"
		info.Color = "#ef4444"
		info.Title = "Packet Flood Detected"
		if floodType, ok := entry.Fields["flood_type"].(string); ok {
			info.Description = floodType + " packet flood detected"
			info.Badges = append(info.Badges, Badge{Label: "Type", Color: "#ef4444", Value: floodType})
		}
		if state, ok := entry.Fields["flood_state"].(string); ok {
			if state == "start" {
				info.Description = "Packet flood started"
			} else {
				info.Description = "Packet flood ended"
				info.Color = "#10b981"
			}
		}
		if device, ok := entry.Fields["source_device"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Source Device", Value: device, Type: "mac"})
		}
		if count, ok := entry.Fields["packet_count"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Packet Count", Value: count, Type: "text"})
		}
		if reason, ok := entry.Fields["end_reason"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "End Reason", Value: reason, Type: "text"})
		}

	case "rogue_ssid":
		info.Icon = "👹"
		info.Color = "#ef4444"
		info.Title = "Rogue SSID Detected"
		info.Description = "Unauthorized SSID detected"
		if ssid, ok := entry.Fields["ssid"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "SSID", Value: ssid, Type: "text"})
		}
		if bssid, ok := entry.Fields["bssid"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "BSSID", Value: bssid, Type: "mac"})
		}
		if channel, ok := entry.Fields["channel"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Channel", Value: channel, Type: "text"})
		}
		if rssi, ok := entry.Fields["rssi"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "RSSI", Value: rssi + " dBm", Type: "text"})
		}
		info.Badges = append(info.Badges, Badge{Label: "Threat", Color: "#ef4444", Value: "Rogue"})

	case "ssid_spoofing":
		info.Icon = "🎭"
		info.Color = "#ef4444"
		info.Title = "SSID Spoofing Detected"
		info.Description = "SSID spoofing attack detected"
		if ssid, ok := entry.Fields["ssid"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "SSID", Value: ssid, Type: "text"})
		}
		if bssid, ok := entry.Fields["bssid"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "BSSID", Value: bssid, Type: "mac"})
		}
		if vap, ok := entry.Fields["vap"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "VAP", Value: vap, Type: "text"})
		}
		if channel, ok := entry.Fields["channel"].(string); ok {
			info.Details = append(info.Details, DetailItem{Label: "Channel", Value: channel, Type: "text"})
		}
		info.Badges = append(info.Badges, Badge{Label: "Threat", Color: "#ef4444", Value: "Spoofing"})

	default:
		info.Icon = "📋"
		info.Color = "#9ca3af"
		info.Title = "Meraki Event"
		info.Description = entry.RawMessage
	}

	// Add device model if available
	if model, ok := entry.Fields["device_model"].(string); ok {
		info.Badges = append(info.Badges, Badge{Label: "Device", Color: "#6366f1", Value: model})
		info.Metadata["device_model"] = model
	}

	return info
}
