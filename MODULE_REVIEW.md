# Module Review and Recommendations

## Current Modules

### 1. Meraki Module (`modules/meraki.go`)
**Status:** ✅ Fully Implemented

**Capabilities:**
- Detects Meraki devices (MX, MS, MR, MV, MG, MT)
- Parses VPN events (IKE/Child SA, AnyConnect)
- Firewall rule matching (L3, cellular, VPN)
- Security events (IDS alerts, AMP file scanning)
- Network events (port status, STP, DHCP)
- Wireless events (802.11, WPA, 802.1X)
- Web events (HTTP requests)

**Strengths:**
- Comprehensive event type coverage
- Rich display information with badges and visualizations
- Action links (VirusTotal, Snort signatures)
- Well-structured field extraction

### 2. Ubiquiti Module (`modules/ubiquiti.go`)
**Status:** ✅ Fully Implemented

**Capabilities:**
- Detects UniFi devices via CEF format
- Parses device-level logs (charon/IPsec, SSH, kernel, DHCP, DNS, WiFi)
- CEF extension field parsing
- Client connection/disconnection tracking
- Firewall and security events
- Network and power events

**Strengths:**
- Dual format support (CEF + device-level)
- Good category inference
- Comprehensive UniFi-specific field extraction

---

## Recommended Additional Modules

### High Priority (Common Enterprise Equipment)

#### 1. **Cisco IOS/IOS-XE Module**
**Priority:** 🔴 High  
**Use Case:** Very common in enterprise networks

**Event Types to Support:**
- Interface state changes (up/down)
- OSPF/BGP neighbor state changes
- ACL violations
- Authentication failures
- Configuration changes
- Link state transitions
- CPU/memory alerts

**Detection Patterns:**
- `%LINEPROTO-5-UPDOWN`
- `%OSPF-5-ADJCHG`
- `%SYS-5-CONFIG_I`
- `%SEC_LOGIN-5-LOGIN_SUCCESS`
- Hostname patterns: `cisco`, `router`, `switch`

**Key Fields:**
- Interface name
- Neighbor IP
- Protocol state
- ACL name/number
- User/authentication info

---

#### 2. **Fortinet FortiGate Module**
**Priority:** 🔴 High  
**Use Case:** Very common enterprise firewall

**Event Types to Support:**
- Firewall traffic (allow/deny)
- VPN tunnel events
- Intrusion prevention (IPS)
- Antivirus events
- Web filtering
- Application control
- SSL inspection
- Authentication events

**Detection Patterns:**
- `date=` (FortiGate timestamp format)
- `devname=` (device name)
- `type=` (log type: traffic, event, etc.)
- `action=` (allow, deny, etc.)
- `srcip=`, `dstip=`, `srcport=`, `dstport=`

**Key Fields:**
- Source/destination IP/port
- Policy ID
- Application name
- Threat name
- User/group
- VPN tunnel name

---

#### 3. **Palo Alto Networks Module**
**Priority:** 🔴 High  
**Use Case:** Common enterprise firewall

**Event Types to Support:**
- Traffic logs (allow/deny)
- Threat logs (malware, spyware, virus)
- URL filtering
- Data filtering
- WildFire submissions
- Authentication events
- Configuration changes

**Detection Patterns:**
- `type=TRAFFIC`
- `type=THREAT`
- `type=URL`
- `type=CONFIG`
- `device_name=`
- `action=`

**Key Fields:**
- Source/destination IP/port
- Application name
- Threat name/ID
- URL category
- User
- Rule name
- NAT information

---

#### 4. **Juniper Module**
**Priority:** 🟡 Medium-High  
**Use Case:** Common in service provider and enterprise networks

**Event Types to Support:**
- Interface state changes
- BGP/OSPF/ISIS neighbor changes
- Authentication events
- Firewall filter matches
- SNMP traps
- Chassis alarms
- Routing protocol events

**Detection Patterns:**
- `IFNET_IFD_UP`
- `IFNET_IFD_DOWN`
- `BGP_NEIGHBOR_STATE_CHANGED`
- `SNMP_TRAP_LINK_DOWN`
- `AUTHENTICATION_FAILED`
- Hostname patterns: `juniper`, `mx`, `ex`, `qfx`

**Key Fields:**
- Interface name
- Neighbor address
- Protocol state
- Alarm type
- User/authentication info

---

### Medium Priority (Common in Specific Environments)

#### 5. **Aruba Module**
**Priority:** 🟡 Medium  
**Use Case:** Wireless and switching in enterprise

**Event Types to Support:**
- Client association/disassociation
- Authentication events (802.1X, WPA)
- Rogue AP detection
- Port security violations
- ClearPass integration events
- AirGroup events

**Detection Patterns:**
- `WLAN-AUTHENTICATION`
- `WLAN-ASSOCIATION`
- `PORT-SECURITY`
- `ROGUE-AP`
- `CLEARPASS`
- Hostname patterns: `aruba`, `ap-`, `mobility-controller`

**Key Fields:**
- Client MAC
- SSID
- AP name
- Authentication method
- User identity
- VLAN

---

#### 6. **pfSense/OPNsense Module**
**Priority:** 🟡 Medium  
**Use Case:** Open-source firewalls (common in SMB)

**Event Types to Support:**
- Firewall rule matches
- VPN events (IPsec, OpenVPN)
- DHCP events
- DNS events
- Intrusion detection (Suricata/Snort)
- Gateway status changes

**Detection Patterns:**
- `filterlog:` (pfSense firewall)
- `charon:` (IPsec)
- `openvpn:`
- `dhcpd:`
- `suricata:`
- `snort:`

**Key Fields:**
- Source/destination IP/port
- Protocol
- Rule number
- Interface
- Gateway status

---

#### 7. **MikroTik RouterOS Module**
**Priority:** 🟡 Medium  
**Use Case:** Common in ISPs and SMB

**Event Types to Support:**
- Interface state changes
- Firewall rule matches
- VPN events (PPTP, L2TP, SSTP, IPsec)
- DHCP events
- Hotspot events
- Wireless events
- OSPF/BGP events

**Detection Patterns:**
- `interface,info`
- `firewall,info`
- `ppp,info`
- `dhcp,info`
- `hotspot,info`
- `wireless,info`
- Hostname patterns: `mikrotik`, `routeros`

**Key Fields:**
- Interface name
- Source/destination IP
- Rule chain
- User
- Service type

---

### Lower Priority (Specialized Use Cases)

#### 8. **Sophos Module**
**Priority:** 🟢 Medium-Low  
**Use Case:** Enterprise security appliances

**Event Types:**
- Firewall events
- Intrusion prevention
- Web filtering
- Antivirus
- VPN events

---

#### 9. **WatchGuard Module**
**Priority:** 🟢 Medium-Low  
**Use Case:** SMB firewalls

**Event Types:**
- Firewall events
- VPN events
- Intrusion prevention
- Web blocking

---

#### 10. **SonicWall Module**
**Priority:** 🟢 Medium-Low  
**Use Case:** SMB/enterprise firewalls

**Event Types:**
- Firewall events
- VPN events
- Intrusion prevention
- Content filtering

---

#### 11. **Linux System Logs Module**
**Priority:** 🟢 Low-Medium  
**Use Case:** Server logs, application hosts

**Event Types:**
- SSH login/logout
- sudo events
- systemd service events
- kernel messages
- authentication events
- cron job execution

**Detection Patterns:**
- `sshd:`
- `sudo:`
- `systemd:`
- `kernel:`
- `CRON:`

---

#### 12. **Application Logs Module (Generic)**
**Priority:** 🟢 Low  
**Use Case:** Web servers, applications

**Event Types:**
- Apache/Nginx access logs
- Application errors
- Database connection events
- API authentication

**Note:** This could be a generic parser that detects common log formats (Apache Combined, Nginx, JSON logs)

---

## Implementation Recommendations

### Phase 1 (Immediate Value)
1. **Cisco IOS/IOS-XE** - Very common, well-documented log formats
2. **Fortinet FortiGate** - Very common firewall, structured log format

### Phase 2 (High Value)
3. **Palo Alto Networks** - Common enterprise firewall
4. **Juniper** - Common in enterprise/service provider

### Phase 3 (Expansion)
5. **Aruba** - If wireless focus
6. **pfSense/OPNsense** - If open-source focus
7. **MikroTik** - If ISP/SMB focus

### Phase 4 (Specialized)
8-12. Based on user requests and specific use cases

---

## Module Development Guidelines

### Detection Strategy
1. **Specific patterns first** - Use unique identifiers (vendor strings, log prefixes)
2. **Hostname patterns** - Secondary detection method
3. **Order matters** - More specific modules should be checked first

### Parsing Strategy
1. **Extract structured fields** - IPs, ports, protocols, users
2. **Normalize field names** - Use consistent naming (source_ip, dest_ip, etc.)
3. **Preserve raw data** - Always keep original message

### Display Strategy
1. **Color coding** - Use consistent colors per event category
2. **Icons** - Use appropriate icons for event types
3. **Actions** - Provide actionable links where possible
4. **Badges** - Show important status information

### Testing Strategy
1. **Sample logs** - Collect real log samples for each device type
2. **Edge cases** - Test malformed logs, missing fields
3. **Performance** - Ensure detection is fast (regex optimization)

---

## Module Template

When creating a new module, follow this structure:

```go
type VendorModule struct{}

func NewVendorModule() *VendorModule {
    return &VendorModule{}
}

func (m *VendorModule) GetDeviceName() string {
    return "vendor"
}

func (m *VendorModule) Detect(rawMessage string) bool {
    // Specific detection patterns
    // Check for unique identifiers first
    // Fall back to hostname patterns
}

func (m *VendorModule) GetEventType(rawMessage string) string {
    // Extract event type from message
    // Return normalized event type string
}

func (m *VendorModule) Parse(rawMessage string, entry *ParsedLog) *ParsedLog {
    // Extract structured fields
    // Set DeviceType, EventType, EventCategory
    // Populate entry.Fields map
}

func (m *VendorModule) GetMetadata() *ModuleMetadata {
    // Return metadata for UI configuration
    // Include event types, common fields, filter suggestions
}

func (m *VendorModule) GetDisplayInfo(entry *ParsedLog) *DisplayInfo {
    // Return display information
    // Icons, colors, badges, details, actions
}
```

---

## Next Steps

1. **Gather sample logs** - Collect real syslog samples from target devices
2. **Prioritize by demand** - Survey users or check common deployments
3. **Start with Cisco** - Most common, well-documented
4. **Iterate** - Add modules based on user feedback and needs

---

## Notes

- **Module order matters**: More specific detection should come first (e.g., Ubiquiti before generic CEF)
- **Enable/disable**: Users can enable/disable modules via UI
- **Generic fallback**: Unknown logs still get stored with "unknown" device type
- **Performance**: Detection should be fast - avoid expensive regex in hot path
- **Extensibility**: Easy to add new modules - just implement interface and register

