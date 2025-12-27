package main

import (
	"bufio"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"github.com/leodido/go-syslog/v4/octetcounting"
)

// Listener management functions

func (s *Server) startListeners() error {
	if s.config.Listeners == nil {
		return nil
	}

	for _, listener := range s.config.Listeners {
		if listener.Enabled {
			if err := s.startListener(listener); err != nil {
				log.Printf("Failed to start listener %s (ID: %s): %v", listener.Name, listener.ID, err)
				// Continue starting other listeners
			}
		}
	}

	return nil
}

func (s *Server) startListener(listener ListenerConfig) error {
	s.listenerMu.Lock()
	defer s.listenerMu.Unlock()

	// Check if already running
	if _, exists := s.activeListeners[listener.ID]; exists {
		return fmt.Errorf("listener %s is already running", listener.ID)
	}

	// Check if port is available
	if !s.isPortAvailable(listener.Protocol, listener.Port) {
		return fmt.Errorf("port %d is already in use", listener.Port)
	}

	var stopFunc func()
	var err error

	switch listener.Protocol {
	case "UDP":
		stopFunc, err = s.startUDPListener(listener)
	case "TCP":
		stopFunc, err = s.startTCPListener(listener)
	case "TLS":
		stopFunc, err = s.startTLSListener(listener)
	default:
		return fmt.Errorf("unknown protocol: %s", listener.Protocol)
	}

	if err != nil {
		return err
	}

	s.activeListeners[listener.ID] = ListenerControl{
		Stop: stopFunc,
		Type: strings.ToLower(listener.Protocol),
	}

	log.Printf("Started listener %s (ID: %s) on port %d", listener.Name, listener.ID, listener.Port)
	return nil
}

// isPortAvailable checks if a port is available for the given protocol
func (s *Server) isPortAvailable(protocol string, port int) bool {
	switch strings.ToUpper(protocol) {
	case "UDP":
		addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", port))
		if err != nil {
			return false
		}
		conn, err := net.ListenUDP("udp", addr)
		if err != nil {
			return false
		}
		conn.Close()
		return true
	case "TCP", "TLS":
		addr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf(":%d", port))
		if err != nil {
			return false
		}
		listener, err := net.ListenTCP("tcp", addr)
		if err != nil {
			return false
		}
		listener.Close()
		return true
	default:
		return false
	}
}

func (s *Server) stopListener(listenerID string) error {
	s.listenerMu.Lock()
	defer s.listenerMu.Unlock()

	control, exists := s.activeListeners[listenerID]
	if !exists {
		return fmt.Errorf("listener %s is not running", listenerID)
	}

	control.Stop()
	delete(s.activeListeners, listenerID)

	log.Printf("Stopped listener %s", listenerID)
	return nil
}

func (s *Server) startUDPListener(listener ListenerConfig) (func(), error) {
	addr, err := net.ResolveUDPAddr("udp", fmt.Sprintf(":%d", listener.Port))
	if err != nil {
		return nil, err
	}

	conn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return nil, err
	}

	log.Printf("UDP syslog listener '%s' listening on port %d", listener.Name, listener.Port)

	stopChan := make(chan struct{})
	done := make(chan struct{})

	go func() {
		defer conn.Close()
		defer close(done)

		buffer := make([]byte, 65535)
		for {
			select {
			case <-stopChan:
				return
			default:
				conn.SetReadDeadline(time.Now().Add(100 * time.Millisecond))
				n, remoteAddr, err := conn.ReadFromUDP(buffer)
				if err != nil {
					if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
						continue
					}
					if err != io.EOF {
						log.Printf("UDP read error: %v", err)
					}
					continue
				}

				go s.processMessage(buffer[:n], remoteAddr.String(), "UDP", listener.Parser)
			}
		}
	}()

	stopFunc := func() {
		close(stopChan)
		conn.Close()
		<-done
	}

	return stopFunc, nil
}

func (s *Server) startTCPListener(listener ListenerConfig) (func(), error) {
	addr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf(":%d", listener.Port))
	if err != nil {
		return nil, err
	}

	tcpListener, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return nil, err
	}

	framing := listener.Framing
	if framing == "" {
		framing = "non-transparent"
	}

	log.Printf("TCP syslog listener '%s' listening on port %d (framing: %s, parser: %s)",
		listener.Name, listener.Port, framing, listener.Parser)

	stopChan := make(chan struct{})
	done := make(chan struct{})

	go func() {
		defer tcpListener.Close()
		defer close(done)

		for {
			select {
			case <-stopChan:
				return
			default:
				tcpListener.SetDeadline(time.Now().Add(100 * time.Millisecond))
				conn, err := tcpListener.AcceptTCP()
				if err != nil {
					if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
						continue
					}
					if err != io.EOF {
						log.Printf("TCP accept error: %v", err)
					}
					continue
				}

				go s.handleTCPConnectionWithConfig(conn, listener)
			}
		}
	}()

	stopFunc := func() {
		close(stopChan)
		tcpListener.Close()
		<-done
	}

	return stopFunc, nil
}

func (s *Server) handleTCPConnectionWithConfig(conn *net.TCPConn, listener ListenerConfig) {
	defer conn.Close()
	remoteAddr := conn.RemoteAddr().String()

	if listener.Framing == "octet-counting" {
		// Use octet counting scanner
		scanner := octetcounting.NewScanner(conn, 65535)
		defer scanner.Release()

		for {
			token := scanner.Scan()
			tokenStr := token.String()
			if tokenStr == "" {
				break
			}
			s.processMessage([]byte(tokenStr), remoteAddr, "TCP", listener.Parser)
		}
	} else {
		// Use non-transparent framing (default)
		scanner := bufio.NewScanner(conn)
		scanner.Buffer(make([]byte, 65535), 65535)

		for scanner.Scan() {
			data := scanner.Bytes()
			if len(data) > 0 {
				s.processMessage(data, remoteAddr, "TCP", listener.Parser)
			}
		}

		if err := scanner.Err(); err != nil && err != io.EOF {
			log.Printf("TCP connection error: %v", err)
		}
	}
}

func (s *Server) startTLSListener(listener ListenerConfig) (func(), error) {
	if listener.CertFile == "" || listener.KeyFile == "" {
		return nil, fmt.Errorf("tls listener requires cert_file and key_file")
	}

	cert, err := tls.LoadX509KeyPair(listener.CertFile, listener.KeyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to load TLS certificate: %w", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{cert},
		// Default: don't require client certificates (most syslog clients don't use them)
		ClientAuth: tls.NoClientCert,
	}

	// If CA cert is provided, use it for client certificate validation (optional)
	// This enables mutual TLS verification if clients present certificates
	if listener.CaCertFile != "" {
		caCert, err := os.ReadFile(listener.CaCertFile)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig.ClientCAs = caCertPool
		// Verify client certificates if provided, but don't require them
		tlsConfig.ClientAuth = tls.VerifyClientCertIfGiven
	}

	addr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf(":%d", listener.Port))
	if err != nil {
		return nil, err
	}

	tlsListener, err := tls.Listen("tcp", addr.String(), tlsConfig)
	if err != nil {
		return nil, err
	}

	log.Printf("TLS syslog listener '%s' listening on port %d (framing: %s, parser: %s)",
		listener.Name, listener.Port, listener.Framing, listener.Parser)

	stopChan := make(chan struct{})
	done := make(chan struct{})

	go func() {
		defer tlsListener.Close()
		defer close(done)

		for {
			select {
			case <-stopChan:
				return
			default:
				// Set deadline for accept to allow checking stopChan
				if tcpListener, ok := tlsListener.(*net.TCPListener); ok {
					tcpListener.SetDeadline(time.Now().Add(100 * time.Millisecond))
				}
				conn, err := tlsListener.Accept()
				if err != nil {
					if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
						continue
					}
					if err != io.EOF {
						log.Printf("TLS accept error: %v", err)
					}
					continue
				}

				go s.handleTLSConnectionWithConfig(conn, listener)
			}
		}
	}()

	stopFunc := func() {
		close(stopChan)
		tlsListener.Close()
		<-done
	}

	return stopFunc, nil
}

func (s *Server) handleTLSConnectionWithConfig(conn net.Conn, listener ListenerConfig) {
	defer conn.Close()
	remoteAddr := conn.RemoteAddr().String()

	// TLS always uses octet counting (RFC5425)
	scanner := octetcounting.NewScanner(conn, 65535)
	defer scanner.Release()

	for {
		token := scanner.Scan()
		tokenStr := token.String()

		// Check if we got a valid token (empty string means EOF or error)
		if tokenStr == "" {
			break
		}

		s.processMessage([]byte(tokenStr), remoteAddr, "TLS", listener.Parser)
	}
}
