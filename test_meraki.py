#!/usr/bin/env python3
"""
Meraki Syslog Test Script
Sends various Meraki syslog messages to test the qLog server
"""

import socket
import time
import sys
from datetime import datetime

def format_syslog_rfc5424(message, priority=165, hostname="meraki-device", appname="events"):
    """
    Format a message as RFC5424 syslog message
    Priority calculation: facility * 8 + severity
    Default: facility=20 (local0), severity=5 (notice) = 165
    """
    version = "1"
    timestamp = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")
    procid = "-"
    msgid = "-"
    
    # Format: <PRI>VERSION TIMESTAMP HOSTNAME APPNAME PROCID MSGID - MSG
    formatted = f"<{priority}>{version} {timestamp} {hostname} {appname} {procid} {msgid} - {message}"
    return formatted

def format_syslog_rfc3164(message, priority=165, hostname="meraki-device", tag="events"):
    """
    Format a message as RFC3164 (BSD) syslog message
    """
    timestamp = datetime.now().strftime("%b %d %H:%M:%S")
    # Format: <PRI>TIMESTAMP HOSTNAME TAG: MSG
    formatted = f"<{priority}>{timestamp} {hostname} {tag}: {message}"
    return formatted

def send_syslog_message(host, port, message, use_rfc5424=True):
    """Send a syslog message via UDP with proper framing"""
    try:
        # Add syslog framing if message doesn't already have it
        if not message.strip().startswith('<'):
            # Extract device info from message
            parts = message.split()
            hostname = "meraki-device"
            if len(parts) > 1:
                # Try to find device model (MX, MS, MR)
                for part in parts:
                    if part.startswith(('MX', 'MS', 'MR')):
                        hostname = part
                        break
            
            if use_rfc5424:
                # Determine appname from message content
                if 'urls' in message.lower():
                    appname = "urls"
                elif 'flows' in message.lower() or 'firewall' in message.lower() or 'cellular_firewall' in message.lower() or 'vpn_firewall' in message.lower():
                    appname = "firewall"
                elif 'ids-alerts' in message.lower() or 'ids_alerted' in message.lower():
                    appname = "ids-alerts"
                elif 'airmarshal' in message.lower():
                    appname = "airmarshal_events"
                elif 'security_event' in message.lower():
                    appname = "security_event"
                else:
                    appname = "events"
                
                # Determine priority based on message type
                priority = 165  # Default: local0.notice
                if 'error' in message.lower() or 'failed' in message.lower() or 'blocked' in message.lower() or 'deny' in message.lower():
                    priority = 163  # local0.error
                elif 'alert' in message.lower() or 'critical' in message.lower() or 'priority=1' in message.lower():
                    priority = 161  # local0.alert
                elif 'warning' in message.lower() or 'priority=2' in message.lower():
                    priority = 162  # local0.warning
                
                formatted = format_syslog_rfc5424(message, priority=priority, hostname=hostname, appname=appname)
            else:
                formatted = format_syslog_rfc3164(message, priority=165, hostname=hostname)
        else:
            # Message already has framing
            formatted = message
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.sendto(formatted.encode('utf-8'), (host, port))
        sock.close()
        return True
    except Exception as e:
        print(f"Error sending message: {e}")
        return False

def main():
    host = sys.argv[1] if len(sys.argv) > 1 else "localhost"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 514
    delay = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
    
    print(f"Meraki Syslog Test Script")
    print(f"Sending test messages to {host}:{port}")
    print()
    
    # Test messages
    messages = [
        # VPN Connectivity Changes
        ("VPN Connectivity Change (Disconnected)", 
         "1380664922.583851938 MX84 events type=vpn_connectivity_change vpn_type='site-to-site' peer_contact='98.68.191.209:51856' peer_ident='2814ee002c075181bb1b7478ee073860' connectivity='false'"),
        
        ("VPN Connectivity Change (Connected)", 
         "1380664994.337961231 MX84 events type=vpn_connectivity_change vpn_type='site-to-site' peer_contact='98.68.191.209:51856' peer_ident='2814ee002c075181bb1b7478ee073860' connectivity='true'"),
        
        # Uplink Connectivity
        ("Cellular Connection Down", 
         "Dec 6 08:46:12 192.168.1.1 1 1386337584.254756845 MX84 events Cellular connection down"),
        
        ("Failover to WAN1", 
         "Dec 6 08:45:24 192.168.1.1 1 1386337535.803931423 MX84 events failover to wan1"),
        
        ("Failover to Cellular", 
         "Dec 6 08:43:43 192.168.1.1 1 1386337435.108107268 MX84 events failover to cellular"),
        
        ("Cellular Connection Up", 
         "Dec 6 08:41:44 192.168.1.1 1 1386337316.207232138 MX84 events Cellular connection up"),
        
        # DHCP Events
        ("DHCP No Offers", 
         "Sep 11 16:12:41 192.168.10.1 1 1599865961.535491111 MX84 events dhcp no offers for mac A4:83:E7:AA:BB:CC host = 192.168.10.1"),
        
        ("DHCP Lease", 
         "Sep 11 16:05:15 192.168.10.1 1 1599865515.687171503 MX84 events dhcp lease of ip 192.168.10.68 from server mac E0:CB:BC:0F:AA:BB for client mac 8C:16:45:CC:DD:EE from router 192.168.10.1 on subnet 255.255.255.0 with dns 8.8.8.8, 8.8.4.4"),
        
        # URLs
        ("HTTP GET Request", 
         "1374543213.342705328 MX84 urls src=192.168.1.186:63735 dst=69.58.188.40:80 mac=58:1F:AA:CE:61:F2 request: GET https://www.example.com/path/to/resource"),
        
        # Firewall/Flows
        ("Firewall Rule Matched (Allow)", 
         "1374543986.038687615 MX84 firewall src=192.168.1.186 dst=8.8.8.8 mac=58:1F:AA:CE:61:F2 protocol=udp sport=55719 dport=53 pattern: allow all"),
        
        ("Flow Allowed", 
         "1380653443.857790533 MR18 flows allow src=192.168.111.253 dst=192.168.111.5 mac=F8:1E:DF:E2:EF:F1 protocol=tcp sport=54252 dport=80"),
        
        ("Flow Denied", 
         "1380653443.857790533 MR18 flows deny src=10.20.213.144 dst=192.168.111.5 mac=00:F4:B9:78:58:01 protocol=tcp sport=52421 dport=80"),
        
        ("Cellular Firewall", 
         "1374543986.038687615 MX84 cellular_firewall src=192.168.1.186 dst=8.8.8.8 mac=58:1F:AA:CE:61:F2 protocol=udp sport=55719 dport=53 pattern: allow all"),
        
        ("VPN Firewall", 
         "1374543986.038687615 MX84 vpn_firewall src=192.168.1.186 dst=8.8.8.8 mac=58:1F:AA:CE:61:F2 protocol=udp sport=55719 dport=53 pattern: allow all"),
        
        # IDS Alerts
        ("IDS Alert (Low Priority)", 
         "1377449842.514782056 MX84 ids-alerts signature=129:4:1 priority=3 timestamp=1377449842.512569 direction=ingress protocol=tcp/ip src=74.125.140.132:80"),
        
        ("IDS Alert (Medium Priority)", 
         "1377448470.246576346 MX84 ids-alerts signature=119:15:1 priority=2 timestamp=1377448470.238064 direction=egress protocol=tcp/ip src=192.168.111.254:56240"),
        
        ("IDS Alert (High Priority)", 
         "1377449842.514782056 MX84 security_event ids_alerted signature=1:28423:1 priority=1 timestamp=1468531589.810079 dhost=98:5A:EB:E1:81:2F direction=ingress protocol=tcp/ip src=151.101.52.238:80 dst=192.168.128.2:53023 decision=blocked action=rst message: EXPLOIT-KIT Multiple exploit kit single digit exe detection"),
        
        # Security Events
        ("Malicious File Blocked", 
         "1377449842.514782056 MX84 security_event security_filtering_file_scanned url=http://www.eicar.org/download/eicar.com.txt src=192.168.128.2:53150 dst=188.40.238.250:80 mac=98:5A:EB:E1:81:2F name='EICAR:EICAR_Test_file_not_a_virus-tpd' sha256=275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f disposition=malicious action=block"),
        
        ("File Disposition Change", 
         "1377449842.514782056 MX84 security_event security_filtering_disposition_change name=EICAR:EICAR_Test_file_not_a_virus-tpd sha256=275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f disposition=malicious action=allow"),
        
        # VPN Phase Events (Post MX 15.12)
        ("IKE_SA Established", 
         "1578424550.965202127 MX84 events VPN: <remote-peer-2|12> IKE_SA remote-peer-2[12] established between 192.168.13.5[192.168.13.5]...192.168.13.2[192.168.13.2]"),
        
        ("CHILD_SA Established", 
         "1578424551.120459981 MX84 events VPN: <remote-peer-2|12> CHILD_SA net-2{1478} established with SPIs cd94e190(inbound) c2b06071(outbound) and TS 192.168.12.0/24 === 192.168.13.0/24"),
        
        ("IKE_SA Deleted", 
         "1578424550.965202127 MX84 events VPN: <remote-peer-2|12> deleting IKE_SA remote-peer-2[12] between 192.168.13.5[192.168.13.5]...192.168.13.2[192.168.13.2]"),
        
        ("CHILD_SA Closed", 
         "1578424551.120459981 MX84 events VPN: <remote-peer-2|12> closing CHILD_SA net-2{1478} with SPIs cd94e190(inbound) (0 bytes) c2b06071(outbound) (0 bytes) and TS 192.168.12.0/24 === 192.168.13.0/24"),
        
        # AnyConnect VPN Events
        ("AnyConnect Server Started", 
         "1720051390.733639600 labs_appliance events type=anyconnect_vpn_general msg= 'AnyConnect server is started. '"),
        
        ("AnyConnect Auth Success", 
         "1720045578.339796505 labs_appliance events type=anyconnect_vpn_auth_success msg= 'Peer IP=192.168.0.1 Peer port=57096 AAA[7]: AAA authentication successful '"),
        
        ("AnyConnect Auth Failure", 
         "1720051237.124589040 labs_appliance events type=anyconnect_vpn_auth_failure msg= 'Peer IP=192.168.0.1Peer port[8748] AAA[8]: AAA authenticate failed retval=7 - Authentication failure '"),
        
        ("AnyConnect Session Manager", 
         "1720045578.340434385 labs_appliance  events type=anyconnect_vpn_session_manager msg= 'Sess-ID[7] Peer IP=192.168.0.1 User[miles@meraki.net]: Session connected. Session Type: TLS '"),
        
        ("AnyConnect Connect", 
         "1720045578.495767745 labs_appliance events anyconnect_vpn_connect user id 'miles@meraki.net' local ip 192.168.5.224 connected from 192.168.0.1"),
        
        ("AnyConnect Disconnect", 
         "1720045578.515109505 labs_appliance events anyconnect_vpn_disconnect user id 'miles@meraki.net' local ip 192.168.5.135 connected from 192.168.0.1"),
        
        # VPN Phase Events (Pre MX 15.12)
        ("ISAKMP-SA Purged", 
         "1578424543.894083034 labs_appliance events Site-to-site VPN: purging ISAKMP-SA spi=9d1bb66d7ddc5cf0:d98cd0ed59e82f13"),
        
        ("ISAKMP-SA Deleted", 
         "1578424543.918665436 labs_appliance events Site-to-site VPN: ISAKMP-SA deleted 172.24.23.6[4500]-172.24.23.10[4500] spi:9d1bb66d7ddc5cf0:d98cd0ed59e82f13"),
        
        ("IPsec-SA Queued", 
         "1578424549.917669303 labs_appliance events Site-to-site VPN: IPsec-SA request for 172.24.23.10 queued due to no phase1 found"),
        
        ("Failed to get sainfo", 
         "1578426208.829677788 labs_Z1 events Site-to-site VPN: failed to get sainfo"),
        
        ("Failed to pre-process ph2 packet", 
         "1578426208.915091184 labs_Z1 events Site-to-site VPN: failed to pre-process ph2 packet (side: 1, status: 1)"),
        
        ("Phase2 Negotiation Failed", 
         "1578424408.321445408 labs_appliance events Site-to-site VPN: phase2 negotiation failed due to time up waiting for phase1. ESP 172.24.23.10[0]->172.24.23.6[0]"),
        
        ("Initiate Phase 1 Negotiation", 
         "1578424549.931720602 labs_appliance events Site-to-site VPN: initiate new phase 1 negotiation: 172.24.23.6[500]<=>172.24.23.10[500]"),
        
        ("ISAKMP-SA Established", 
         "1578424550.965202127 labs_appliance events Site-to-site VPN: ISAKMP-SA established 172.24.23.6[4500]-172.24.23.10[4500] spi:fb903f191f1c7566:4dc90bd31c7884c1"),
        
        ("Initiate Phase 2 Negotiation", 
         "1578424550.975495647 labs_appliance events Site-to-site VPN: initiate new phase 2 negotiation: 172.24.23.6[4500]<=>172.24.23.10[4500]"),
        
        ("IPsec-SA Established", 
         "1578424551.120459981 labs_appliance events Site-to-site VPN: IPsec-SA established: ESP/Tunnel 172.24.23.6[4500]->172.24.23.10[4500] spi=241280704(0xe61a6c0)"),
        
        # MS Switch Events
        ("Port Status Change (Down)", 
         "1379967288.409907239 MS220_8P events port 3 status changed from 100fdx to down"),
        
        ("Port Status Change (Up)", 
         "1379967295.290863061 MS220_8P events port 3 status changed from down to 100fdx"),
        
        ("STP Guard Triggered", 
         "1379970281.577982192 MS220_8P events Port 5 received an STP BPDU from 78:FE:3D:90:7F:43 so the port was blocked"),
        
        ("STP Role Change", 
         "1379970476.195563376 MS220_8P events Port 5 changed STP role from designated to alternate"),
        
        ("STP Role Change (Root)", 
         "1379970772.184373058 MS220_8P events Port 5 changed STP role from alternate to root"),
        
        ("DHCP Server Blocked", 
         "1379988354.643337272 MS220_8P events Blocked DHCP server response from 78:FE:3D:90:7F:48 on VLAN 100"),
        
        ("802.1X Authentication", 
         "1380653443.868786613 MS220_8P events type=8021x_auth port='3' identity='employee@ikarem.com'"),
        
        ("802.1X EAP Success", 
         "1380653443.857790533 MS220_8P events type=8021x_eap_success port='' identity='employee@ikarem.com'"),
        
        ("802.1X Deauthentication", 
         "1380653487.002002676 MS220_8P events type=8021x_deauth port='' identity='employee@ikarem.com'"),
        
        ("802.1X Client Deauthentication", 
         "1380653486.994003049 MS220_8P events type=8021x_client_deauth port='3' identity='employee@ikarem.com'"),
        
        ("VRRP Collision", 
         "1379988354.643337272 MS320_24P events Received VRRP packet for virtual router 1 from 10.0.0.1 on VLAN 100 with incompatible configuration"),
        
        ("VRRP Transition", 
         "1379988354.643337272 MS320_24P events changed from VRRP passive to VRRP active because it has not received packets from the active"),
        
        ("Power Supply Inserted", 
         "1379988354.643337272 MS320_24P events Power supply xxxx-xxxx-xxxx was inserted into slot 1"),
        
        # MR Access Point Events
        ("802.11 Association", 
         "1380653443.857790533 MR18 events type=association radio='0' vap='1' channel='6' rssi='23' aid='1813578850'"),
        
        ("802.11 Disassociation", 
         "1380653443.857790533 MR18 events type=disassociation radio='0' vap='1' channel='6' reason='8' instigator='2' duration='11979.728000' auth_neg_dur='1380653443.85779053324000' last_auth_ago='5.074000' is_wpa='1' full_conn='1.597000' ip_resp='1.597000' ip_src='192.168.111.251' arp_resp='1.265000' arp_src='192.168.111.251' dns_server='192.168.111.1' dns_req_rtt='1380653443.85779053335000' dns_resp='1.316000' aid='1813578850'"),
        
        ("WPA Authentication", 
         "1380653443.857790533 MR18 events type=wpa_auth radio='0' vap='1' aid='1813578850'"),
        
        ("WPA Deauthentication", 
         "1380653443.857790533 MR18 events type=wpa_deauth radio='0' vap='1' aid='1813578850'"),
        
        ("WPA Failed Authentication", 
         "1380653443.857790533 MR18 events type=disassociation radio='0' vap='3' channel='6' reason='2' instigator='3' duration='6.003000' auth_neg_failed='1' is_wpa='1' aid='113930199'"),
        
        ("802.1X EAP Failure", 
         "1380653443.857790533 MR18 events type=8021x_eap_failure radio='0' vap='3' identity='woody8@gmail.com' aid='1701992265'"),
        
        ("802.1X Deauthentication (MR)", 
         "1380653443.857790533 MR18 events type=8021x_deauth radio='0' vap='3' identity='woody8@gmail.com' aid='1701992265'"),
        
        ("802.1X EAP Success (MR)", 
         "1380653443.857790533 MR18 events type=8021x_eap_success radio='0' vap='3' identity='woody8@gmail.com' aid='1849280097'"),
        
        ("Splash Authentication", 
         "1380653443.857790533 MR18 events type=splash_auth ip='10.87.195.250 [More Information] ' duration='3600' vap='2' download='5242880bps' upload='5242880bps'"),
        
        ("Packet Flood Detected", 
         "1380653443.857790533 MR18 events type=device_packet_flood packet='deauth' device='00:18:0A:27:43:80' radio='0' state='start' alarm_id='4' dos_count='25' inter_arrival='10000'"),
        
        ("Packet Flood End", 
         "1380653443.857790533 MR18 events type=device_packet_flood radio='0' state='end' alarm_id='4' reason='left_channel'"),
        
        ("Rogue SSID Detected", 
         "1380653443.857790533 MR18 airmarshal_events type= rogue_ssid_detected ssid='RogueNetwork' bssid='02:18:5A:AE:56:00' src='02:18:5A:AE:56:00' dst='02:18:6A:13:09:D0' wired_mac='00:18:0A:AE:56:00' vlan_id='0' channel='157' rssi='21' fc_type='0' fc_subtype='5'"),
        
        ("SSID Spoofing Detected", 
         "1380653443.857790533 MR18 airmarshal_events type= ssid_spoofing_detected ssid='t-nebojsa_devel1' vap='2' bssid='02:18:5A:14:04:E2' src='02:18:5A:14:04:E2' dst='FF:FF:FF:FF:FF:FF' channel='48' rssi='39' fc_type='0' fc_subtype='8'"),
        
        ("MR URLs", 
         "1380653443.857790533 MR18 urls src=192.168.111.253:50215 dst=204.154.94.81:443 mac=F8:1E:DF:E2:EF:F1 request: UNKNOWN https://www.evernote.com/"),
    ]
    
    success_count = 0
    fail_count = 0
    
    for name, message in messages:
        # Extract device model from message for hostname
        hostname = "meraki-device"
        if "MX" in message:
            hostname = message.split()[1] if len(message.split()) > 1 else "MX84"
        elif "MS" in message:
            hostname = message.split()[1] if len(message.split()) > 1 else "MS220"
        elif "MR" in message:
            hostname = message.split()[1] if len(message.split()) > 1 else "MR18"
        
        if send_syslog_message(host, port, message, use_rfc5424=True):
            print(f"[✓] {name}")
            success_count += 1
        else:
            print(f"[✗] {name} - Failed to send")
            fail_count += 1
        
        time.sleep(delay)
    
    print()
    print("Test Complete!")
    print(f"Success: {success_count}")
    print(f"Failed: {fail_count}")
    print()
    print("Check the qLog web UI at http://localhost:8080 to view the logs")

if __name__ == "__main__":
    main()

