# Device Module System

The qLog syslog server includes a modular system for parsing and displaying device-specific information from syslog messages.

## Architecture

### Module Interface

Each device module implements the `DeviceModule` interface:

```go
type DeviceModule interface {
    Detect(rawMessage string) bool
    Parse(rawMessage string, entry *ParsedLog) *ParsedLog
    GetDeviceName() string
    GetEventType(rawMessage string) string
    GetDisplayInfo(entry *ParsedLog) *DisplayInfo
}
```

### Module Registry

The `ModuleRegistry` automatically detects and parses logs using registered modules:

1. **Detection**: Each module's `Detect()` method checks if a log message matches that device type
2. **Parsing**: The first matching module parses the message and extracts structured data
3. **Display**: The module provides UI display information including icons, colors, badges, and actions

## Meraki Module

The Meraki module supports parsing of various Meraki device types:

### Supported Event Types

- **VPN Events**
  - VPN connectivity changes
  - Phase 1/2 tunnel establishment/destruction
  - AnyConnect VPN events

- **Firewall Events**
  - L3 firewall rule matches
  - Traffic flows (allow/deny)
  - Protocol, source, destination extraction

- **Security Events**
  - IDS alerts with signature IDs
  - Security filtering events
  - Priority-based alerting

- **Network Events**
  - Port status changes
  - STP events
  - DHCP lease/no offers

- **Wireless Events**
  - 802.11 association/disassociation
  - WPA authentication
  - 802.1X authentication
  - RSSI, channel, VAP information

- **Web Events**
  - HTTP GET/POST requests
  - URL tracking

### Display Features

The Meraki module provides:

1. **Color-coded Icons**: Different icons for different event types
2. **Badges**: Status badges (Connected/Disconnected, Priority levels, etc.)
3. **Flow Visualization**: Visual representation of firewall traffic flows
4. **Action Links**: Links to view rules, signatures, etc.
5. **Structured Details**: Extracted fields displayed in organized sections

## Adding New Device Modules

To add support for a new device type:

1. Create a new file in `modules/` directory (e.g., `modules/cisco.go`)
2. Implement the `DeviceModule` interface
3. Register the module in `modules/module.go`:

```go
func init() {
    registry = &ModuleRegistry{
        modules: []DeviceModule{
            NewMerakiModule(),
            NewCiscoModule(), // Add your module here
        },
    }
}
```

### Example Module Structure

```go
type CiscoModule struct{}

func NewCiscoModule() *CiscoModule {
    return &CiscoModule{}
}

func (m *CiscoModule) GetDeviceName() string {
    return "cisco"
}

func (m *CiscoModule) Detect(rawMessage string) bool {
    // Detection logic
    return strings.Contains(rawMessage, "Cisco")
}

func (m *CiscoModule) GetEventType(rawMessage string) string {
    // Extract event type
    return "interface_down"
}

func (m *CiscoModule) Parse(rawMessage string, entry *ParsedLog) *ParsedLog {
    // Parse and extract fields
    entry.DeviceType = "cisco"
    entry.EventType = m.GetEventType(rawMessage)
    // ... extract fields into entry.Fields
    return entry
}

func (m *CiscoModule) GetDisplayInfo(entry *ParsedLog) *DisplayInfo {
    // Return display information
    return &DisplayInfo{
        Icon: "🔌",
        Color: "#ef4444",
        Title: "Interface Down",
        // ... more display info
    }
}
```

## Database Integration

Parsed device information is stored in the database:

- `device_type`: The device type (e.g., "meraki")
- `event_type`: The specific event type (e.g., "firewall", "vpn_connectivity_change")
- `event_category`: Category grouping (e.g., "VPN", "Security", "Network")
- `parsed_fields`: JSON blob of extracted fields

## UI Integration

The web UI automatically:

1. **Displays device icons** in log lists
2. **Shows event type badges** for parsed events
3. **Renders device-specific detail modals** with:
   - Color-coded headers
   - Badges and status indicators
   - Structured detail sections
   - Flow visualizations (for firewall events)
   - Action buttons (view rule, view signature, etc.)
   - Links to external resources

## Benefits

1. **Extensibility**: Easy to add new device types
2. **Clean UI**: Device-specific information displayed appropriately
3. **Actionable**: Links to rules, signatures, and other relevant resources
4. **Visual**: Icons, colors, and visualizations make logs easier to understand
5. **Structured**: Extracted fields enable better filtering and search

