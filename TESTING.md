# Testing qLog with Meraki Syslog Messages

This directory contains test scripts to send various Meraki syslog messages to the qLog server for testing.

## Test Scripts

### PowerShell (Windows)
```powershell
.\test_meraki.ps1
```

With custom host/port/delay:
```powershell
.\test_meraki.ps1 -Host localhost -Port 514 -Delay 1
```

### Python (Cross-platform)
```bash
python3 test_meraki.py
```

With custom host/port/delay:
```bash
python3 test_meraki.py localhost 514 1
```

### Bash (Linux/Mac)
```bash
chmod +x test_meraki.sh
./test_meraki.sh
```

With custom host/port/delay:
```bash
./test_meraki.sh localhost 514 1
```

## Test Coverage

The test scripts send messages covering:

### MX Security Appliance Events
- VPN connectivity changes (site-to-site)
- Uplink connectivity changes (Cellular, WAN failover)
- DHCP lease and no offers
- HTTP GET requests (URLs)
- Firewall rule matches (allow/deny)
- IDS alerts (various priority levels)
- Security file scanning (AMP)
- VPN Phase 1/2 events (IKE_SA, CHILD_SA)
- AnyConnect VPN events

### MS Switch Events
- Port status changes
- STP guard triggers and role changes
- DHCP server blocking
- 802.1X authentication/deauthentication
- VRRP collisions and transitions
- Power supply insertion

### MR Access Point Events
- 802.11 association/disassociation
- WPA authentication/deauthentication
- 802.1X authentication
- Splash page authentication
- Packet flood detection
- Rogue SSID detection
- SSID spoofing detection

## Usage

1. **Start the qLog server:**
   ```bash
   ./qlog
   ```

2. **Run the test script:**
   ```powershell
   # Windows
   .\test_meraki.ps1
   
   # Linux/Mac
   ./test_meraki.sh
   
   # Python (any platform)
   python3 test_meraki.py
   ```

3. **View results in the web UI:**
   Open http://localhost:8080 in your browser

## Expected Results

After running the test script, you should see:

- All messages appear in the logs view
- Device type detected as "meraki"
- Event types correctly identified
- Parsed fields extracted and displayed
- Device-specific UI elements (icons, colors, badges)
- Visualizations for firewall flows, VPN tunnels, etc.
- Clickable log entries showing detailed information

## Troubleshooting

If messages aren't appearing:

1. **Check server is running:**
   ```bash
   # Should show listening on port 514
   netstat -an | findstr 514
   ```

2. **Check firewall:**
   - Ensure UDP port 514 is not blocked
   - On Windows, you may need to run PowerShell as Administrator

3. **Check server logs:**
   - Look for "UDP syslog server listening on port 514"
   - Check for any parse errors

4. **Verify database:**
   - Check that `qlog.db` is being created
   - Verify logs are being stored

## Custom Testing

To test specific event types, you can modify the scripts or send individual messages:

**PowerShell:**
```powershell
$udpClient = New-Object System.Net.Sockets.UdpClient
$endpoint = New-Object System.Net.IPEndPoint([System.Net.IPAddress]::Parse("localhost"), 514)
$message = "1380664922.583851938 MX84 events type=vpn_connectivity_change vpn_type='site-to-site' peer_contact='98.68.191.209:51856' peer_ident='2814ee002c075181bb1b7478ee073860' connectivity='false'"
$bytes = [System.Text.Encoding]::ASCII.GetBytes($message)
$udpClient.Send($bytes, $bytes.Length, $endpoint)
$udpClient.Close()
```

**Python:**
```python
import socket
sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.sendto(b"1380664922.583851938 MX84 events type=vpn_connectivity_change...", ("localhost", 514))
sock.close()
```

**Bash:**
```bash
echo "1380664922.583851938 MX84 events type=vpn_connectivity_change..." | nc -u localhost 514
```

