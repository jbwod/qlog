# qLog - Enterprise Syslog Server

A comprehensive, production-ready syslog server with database storage, multi-protocol support, and a modern web UI.

## Features

### Protocol Support
- **UDP** (RFC5426) - One message per packet
- **TCP** (RFC6587) - Non-transparent framing
- **TLS** (RFC5425) - Octet counting with encryption
- **RFC5424** - Modern syslog format
- **RFC3164** - BSD syslog format

### Parsing Features
- Best effort parsing mode
- Automatic format detection (RFC5424/RFC3164)
- Structured data support
- Octet counting and non-transparent framing

### Database
- SQLite database with WAL mode
- Indexed queries for fast retrieval
- Persistent storage
- Statistics and analytics

### Web UI
- Modern, sleek dashboard
- Real-time log viewing
- Interactive charts and analytics
- Advanced filtering and search
- Responsive design
- Dark theme

## Installation

```bash
go get github.com/leodido/go-syslog/v4
go get github.com/mattn/go-sqlite3
go build
```

## Configuration

Create a `config.json` file:

```json
{
  "database": {
    "path": "qlog.db"
  },
  "servers": {
    "udp": {
      "enabled": true,
      "port": 514
    },
    "tcp": {
      "enabled": true,
      "port": 514
    },
    "tls": {
      "enabled": false,
      "port": 6514,
      "cert_file": "server.crt",
      "key_file": "server.key"
    }
  },
  "web": {
    "port": 8080
  },
  "parsing": {
    "best_effort": true,
    "rfc3164_enabled": true,
    "rfc5424_enabled": true
  }
}
```

## Usage

### Start the Server

```bash
./qlog
```

Or with custom config:
```bash
./qlog -config /path/to/config.json
```

### Access the Web UI

Open your browser and navigate to:
```
http://localhost:8080
```

### Send Test Messages

**Using logger (Linux/Mac):**
```bash
logger -n localhost -P 514 "Test message"
```

**Using PowerShell (Windows):**
```powershell
$udpClient = New-Object System.Net.Sockets.UdpClient
$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse("127.0.0.1"), 514)
$message = [System.Text.Encoding]::ASCII.GetBytes("<165>1 2024-01-01T12:00:00Z hostname appname procid msgid - Test message")
$udpClient.Send($message, $message.Length, $endpoint)
```

**Using netcat:**
```bash
echo "<165>1 2024-01-01T12:00:00Z hostname appname procid msgid - Test message" | nc -u localhost 514
```

## Web UI Features

### Dashboard
- Real-time statistics
- Message count by severity
- Protocol distribution charts
- Recent logs preview

### Logs View
- Advanced filtering (severity, hostname, appname)
- Full-text search
- Pagination
- Click to view details

### Analytics
- Top hostnames
- Top applications
- Message trends
- Protocol statistics

### Settings
- Auto-refresh toggle
- Refresh interval configuration

## Architecture

- **Go backend**: High-performance syslog parsing
- **SQLite database**: Persistent storage with indexes
- **REST API**: JSON endpoints for web UI
- **Modern UI**: Vanilla JavaScript with Chart.js
- **Thread-safe**: Concurrent message processing

## Database Schema

The database stores logs with the following fields:
- ID, Timestamp, Priority, Facility, Severity
- Version, Hostname, Appname, ProcID, MsgID
- Message, Structured Data, Raw Message
- Remote Address, Protocol, RFC Format

Indexes are created on:
- Timestamp
- Severity
- Hostname
- Appname
- Created At

## Production Deployment

1. **Generate TLS certificates** (for TLS support):
```bash
openssl req -x509 -newkey rsa:4096 -keyout server.key -out server.crt -days 365 -nodes
```

2. **Configure firewall** to allow ports:
- 514 (UDP/TCP)
- 6514 (TLS)
- 8080 (Web UI)

3. **Run as service** (systemd example):
```ini
[Unit]
Description=qLog Syslog Server
After=network.target

[Service]
Type=simple
User=qlog
WorkingDirectory=/opt/qlog
ExecStart=/opt/qlog/qlog
Restart=always

[Install]
WantedBy=multi-user.target
```

## License

MIT
