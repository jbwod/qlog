#!/bin/bash
# Meraki Syslog Test Script for Linux/Mac
# Sends various Meraki syslog messages to test the qLog server

HOST=${1:-localhost}
PORT=${2:-514}
DELAY=${3:-1}

echo "Meraki Syslog Test Script"
echo "Sending test messages to $HOST:$PORT"
echo ""

# Function to send message
send_message() {
    local name="$1"
    local message="$2"
    
    if echo -n "$message" | nc -u -w1 $HOST $PORT 2>/dev/null; then
        echo "[✓] $name"
        return 0
    else
        echo "[✗] $name - Failed to send"
        return 1
    fi
}

success=0
fail=0

# VPN Connectivity Changes
send_message "VPN Connectivity Change (Disconnected)" "1380664922.583851938 MX84 events type=vpn_connectivity_change vpn_type='site-to-site' peer_contact='98.68.191.209:51856' peer_ident='2814ee002c075181bb1b7478ee073860' connectivity='false'" && ((success++)) || ((fail++))
sleep $DELAY

send_message "VPN Connectivity Change (Connected)" "1380664994.337961231 MX84 events type=vpn_connectivity_change vpn_type='site-to-site' peer_contact='98.68.191.209:51856' peer_ident='2814ee002c075181bb1b7478ee073860' connectivity='true'" && ((success++)) || ((fail++))
sleep $DELAY

# Uplink Connectivity
send_message "Cellular Connection Down" "Dec 6 08:46:12 192.168.1.1 1 1386337584.254756845 MX84 events Cellular connection down" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Failover to WAN1" "Dec 6 08:45:24 192.168.1.1 1 1386337535.803931423 MX84 events failover to wan1" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Failover to Cellular" "Dec 6 08:43:43 192.168.1.1 1 1386337435.108107268 MX84 events failover to cellular" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Cellular Connection Up" "Dec 6 08:41:44 192.168.1.1 1 1386337316.207232138 MX84 events Cellular connection up" && ((success++)) || ((fail++))
sleep $DELAY

# DHCP Events
send_message "DHCP No Offers" "Sep 11 16:12:41 192.168.10.1 1 1599865961.535491111 MX84 events dhcp no offers for mac A4:83:E7:AA:BB:CC host = 192.168.10.1" && ((success++)) || ((fail++))
sleep $DELAY

send_message "DHCP Lease" "Sep 11 16:05:15 192.168.10.1 1 1599865515.687171503 MX84 events dhcp lease of ip 192.168.10.68 from server mac E0:CB:BC:0F:AA:BB for client mac 8C:16:45:CC:DD:EE from router 192.168.10.1 on subnet 255.255.255.0 with dns 8.8.8.8, 8.8.4.4" && ((success++)) || ((fail++))
sleep $DELAY

# URLs
send_message "HTTP GET Request" "1374543213.342705328 MX84 urls src=192.168.1.186:63735 dst=69.58.188.40:80 mac=58:1F:AA:CE:61:F2 request: GET https://www.example.com/path/to/resource" && ((success++)) || ((fail++))
sleep $DELAY

# Firewall/Flows
send_message "Firewall Rule Matched (Allow)" "1374543986.038687615 MX84 firewall src=192.168.1.186 dst=8.8.8.8 mac=58:1F:AA:CE:61:F2 protocol=udp sport=55719 dport=53 pattern: allow all" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Flow Allowed" "1380653443.857790533 MR18 flows allow src=192.168.111.253 dst=192.168.111.5 mac=F8:1E:DF:E2:EF:F1 protocol=tcp sport=54252 dport=80" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Flow Denied" "1380653443.857790533 MR18 flows deny src=10.20.213.144 dst=192.168.111.5 mac=00:F4:B9:78:58:01 protocol=tcp sport=52421 dport=80" && ((success++)) || ((fail++))
sleep $DELAY

# IDS Alerts
send_message "IDS Alert (Low Priority)" "1377449842.514782056 MX84 ids-alerts signature=129:4:1 priority=3 timestamp=1377449842.512569 direction=ingress protocol=tcp/ip src=74.125.140.132:80" && ((success++)) || ((fail++))
sleep $DELAY

send_message "IDS Alert (Medium Priority)" "1377448470.246576346 MX84 ids-alerts signature=119:15:1 priority=2 timestamp=1377448470.238064 direction=egress protocol=tcp/ip src=192.168.111.254:56240" && ((success++)) || ((fail++))
sleep $DELAY

send_message "IDS Alert (High Priority)" "1377449842.514782056 MX84 security_event ids_alerted signature=1:28423:1 priority=1 timestamp=1468531589.810079 dhost=98:5A:EB:E1:81:2F direction=ingress protocol=tcp/ip src=151.101.52.238:80 dst=192.168.128.2:53023 decision=blocked action=rst message: EXPLOIT-KIT Multiple exploit kit single digit exe detection" && ((success++)) || ((fail++))
sleep $DELAY

# Security Events
send_message "Malicious File Blocked" "1377449842.514782056 MX84 security_event security_filtering_file_scanned url=http://www.eicar.org/download/eicar.com.txt src=192.168.128.2:53150 dst=188.40.238.250:80 mac=98:5A:EB:E1:81:2F name='EICAR:EICAR_Test_file_not_a_virus-tpd' sha256=275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f disposition=malicious action=block" && ((success++)) || ((fail++))
sleep $DELAY

# VPN Phase Events
send_message "IKE_SA Established" "1578424550.965202127 MX84 events VPN: <remote-peer-2|12> IKE_SA remote-peer-2[12] established between 192.168.13.5[192.168.13.5]...192.168.13.2[192.168.13.2]" && ((success++)) || ((fail++))
sleep $DELAY

send_message "CHILD_SA Established" "1578424551.120459981 MX84 events VPN: <remote-peer-2|12> CHILD_SA net-2{1478} established with SPIs cd94e190(inbound) c2b06071(outbound) and TS 192.168.12.0/24 === 192.168.13.0/24" && ((success++)) || ((fail++))
sleep $DELAY

# AnyConnect Events
send_message "AnyConnect Server Started" "1720051390.733639600 labs_appliance events type=anyconnect_vpn_general msg= 'AnyConnect server is started. '" && ((success++)) || ((fail++))
sleep $DELAY

send_message "AnyConnect Auth Success" "1720045578.339796505 labs_appliance events type=anyconnect_vpn_auth_success msg= 'Peer IP=192.168.0.1 Peer port=57096 AAA[7]: AAA authentication successful '" && ((success++)) || ((fail++))
sleep $DELAY

send_message "AnyConnect Connect" "1720045578.495767745 labs_appliance events anyconnect_vpn_connect user id 'miles@meraki.net' local ip 192.168.5.224 connected from 192.168.0.1" && ((success++)) || ((fail++))
sleep $DELAY

# MS Switch Events
send_message "Port Status Change (Down)" "1379967288.409907239 MS220_8P events port 3 status changed from 100fdx to down" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Port Status Change (Up)" "1379967295.290863061 MS220_8P events port 3 status changed from down to 100fdx" && ((success++)) || ((fail++))
sleep $DELAY

send_message "STP Guard Triggered" "1379970281.577982192 MS220_8P events Port 5 received an STP BPDU from 78:FE:3D:90:7F:43 so the port was blocked" && ((success++)) || ((fail++))
sleep $DELAY

send_message "802.1X Authentication" "1380653443.868786613 MS220_8P events type=8021x_auth port='3' identity='employee@ikarem.com'" && ((success++)) || ((fail++))
sleep $DELAY

# MR Access Point Events
send_message "802.11 Association" "1380653443.857790533 MR18 events type=association radio='0' vap='1' channel='6' rssi='23' aid='1813578850'" && ((success++)) || ((fail++))
sleep $DELAY

send_message "802.11 Disassociation" "1380653443.857790533 MR18 events type=disassociation radio='0' vap='1' channel='6' reason='8' instigator='2' duration='11979.728000' auth_neg_dur='1380653443.85779053324000' last_auth_ago='5.074000' is_wpa='1' full_conn='1.597000' ip_resp='1.597000' ip_src='192.168.111.251' arp_resp='1.265000' arp_src='192.168.111.251' dns_server='192.168.111.1' dns_req_rtt='1380653443.85779053335000' dns_resp='1.316000' aid='1813578850'" && ((success++)) || ((fail++))
sleep $DELAY

send_message "WPA Authentication" "1380653443.857790533 MR18 events type=wpa_auth radio='0' vap='1' aid='1813578850'" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Splash Authentication" "1380653443.857790533 MR18 events type=splash_auth ip='10.87.195.250 [More Information] ' duration='3600' vap='2' download='5242880bps' upload='5242880bps'" && ((success++)) || ((fail++))
sleep $DELAY

send_message "Rogue SSID Detected" "1380653443.857790533 MR18 airmarshal_events type= rogue_ssid_detected ssid='RogueNetwork' bssid='02:18:5A:AE:56:00' src='02:18:5A:AE:56:00' dst='02:18:6A:13:09:D0' wired_mac='00:18:0A:AE:56:00' vlan_id='0' channel='157' rssi='21' fc_type='0' fc_subtype='5'" && ((success++)) || ((fail++))
sleep $DELAY

echo ""
echo "Test Complete!"
echo "Success: $success"
echo "Failed: $fail"
echo ""
echo "Check the qLog web UI at http://localhost:8080 to view the logs"

