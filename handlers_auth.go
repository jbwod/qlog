package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// Session duration: 24 hours
const SessionDuration = 24 * time.Hour

// Authentication handlers

// handleAuthSetup handles first-time admin setup
func (s *Server) handleAuthSetup(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check if admin already exists
	hasAdmin, err := s.db.HasAdmin()
	if err != nil {
		http.Error(w, fmt.Sprintf("error checking admin: %v", err), http.StatusInternalServerError)
		return
	}
	if hasAdmin {
		http.Error(w, "admin user already exists", http.StatusForbidden)
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		http.Error(w, "username and password are required", http.StatusBadRequest)
		return
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, fmt.Sprintf("error hashing password: %v", err), http.StatusInternalServerError)
		return
	}

	// Create admin user
	if err := s.db.CreateUser(req.Username, string(passwordHash), "admin"); err != nil {
		http.Error(w, fmt.Sprintf("error creating user: %v", err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Admin user created successfully",
	})
}

// handleAuthLogin handles user login
func (s *Server) handleAuthLogin(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Username == "" || req.Password == "" {
		http.Error(w, "username and password are required", http.StatusBadRequest)
		return
	}

	// Get client IP address
	ipAddress := getClientIP(r)

	// Get user from database
	user, err := s.db.GetUserByUsername(req.Username)
	if err != nil {
		// Log failed login attempt
		s.db.LogLoginAttempt(req.Username, ipAddress, false)
		// Don't reveal if user exists or not
		http.Error(w, "invalid username or password", http.StatusUnauthorized)
		return
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		// Log failed login attempt
		s.db.LogLoginAttempt(req.Username, ipAddress, false)
		http.Error(w, "invalid username or password", http.StatusUnauthorized)
		return
	}

	// Log successful login attempt
	s.db.LogLoginAttempt(req.Username, ipAddress, true)

	// Invalidate all existing sessions for this user (session fixation protection)
	s.db.DeleteUserSessions(user.ID)

	// Generate new session ID (session fixation protection)
	sessionID, err := generateSessionID()
	if err != nil {
		http.Error(w, fmt.Sprintf("error generating session: %v", err), http.StatusInternalServerError)
		return
	}

	// Calculate expiration time
	expiresAt := time.Now().Add(SessionDuration).Format(time.RFC3339)

	// Create session in database with IP address
	if err := s.db.CreateSessionWithIP(sessionID, user.ID, ipAddress, expiresAt); err != nil {
		http.Error(w, fmt.Sprintf("error creating session: %v", err), http.StatusInternalServerError)
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteStrictMode,
		MaxAge:   int(SessionDuration.Seconds()),
	})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    "success",
		"message":   "Login successful",
		"username":  user.Username,
		"role":      user.Role,
		"expiresAt": expiresAt,
	})
}

// handleAuthLogout handles user logout
func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "POST" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get session cookie
	cookie, err := r.Cookie("session")
	if err != nil {
		// No session cookie, already logged out
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "success",
			"message": "Logged out",
		})
		return
	}

	// Delete session from database
	s.db.DeleteSession(cookie.Value)

	// Clear session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   false,
		SameSite: http.SameSiteStrictMode,
		MaxAge:   -1,
	})

	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "success",
		"message": "Logged out",
	})
}

// handleAuthStatus checks authentication status
func (s *Server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Check if admin exists
	hasAdmin, err := s.db.HasAdmin()
	if err != nil {
		http.Error(w, fmt.Sprintf("error checking admin: %v", err), http.StatusInternalServerError)
		return
	}

	if !hasAdmin {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
			"setupRequired": true,
		})
		return
	}

	// Get session cookie
	cookie, err := r.Cookie("session")
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
			"setupRequired": false,
		})
		return
	}

	// Verify session
	session, err := s.db.GetSession(cookie.Value)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": false,
			"setupRequired": false,
		})
		return
	}

	// Get user info
	user, err := s.db.GetUserByID(session.UserID)
	if err != nil {
		// For now, just return session info
		json.NewEncoder(w).Encode(map[string]interface{}{
			"authenticated": true,
			"setupRequired": false,
			"sessionID":     session.ID,
			"expiresAt":     session.ExpiresAt,
		})
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"authenticated": true,
		"setupRequired": false,
		"username":      user.Username,
		"role":          user.Role,
		"expiresAt":     session.ExpiresAt,
	})
}

// handleLoginHistoryAPI returns login attempt history
func (s *Server) handleLoginHistoryAPI(w http.ResponseWriter, r *http.Request) {
	addSecurityHeaders(w)
	w.Header().Set("Content-Type", "application/json")

	if r.Method != "GET" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get query parameters for pagination
	limit := 100 // Default limit
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsedLimit := parseInt(limitStr, 100); parsedLimit > 0 && parsedLimit <= 1000 {
			limit = parsedLimit
		}
	}

	attempts, err := s.db.GetLoginAttempts(limit)
	if err != nil {
		http.Error(w, fmt.Sprintf("error fetching login history: %v", err), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"attempts": attempts,
		"count":    len(attempts),
	})
}

// parseInt parses a string to int with default fallback
func parseInt(s string, defaultValue int) int {
	var result int
	if _, err := fmt.Sscanf(s, "%d", &result); err != nil {
		return defaultValue
	}
	return result
}

// Helper functions

// generateSessionID generates a random session ID
func generateSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

// getSessionFromRequest extracts and validates session from request
func (s *Server) getSessionFromRequest(r *http.Request) (*Session, error) {
	cookie, err := r.Cookie("session")
	if err != nil {
		return nil, err
	}

	session, err := s.db.GetSession(cookie.Value)
	if err != nil {
		return nil, err
	}

	// Validate IP address (IP-based session validation)
	clientIP := getClientIP(r)
	if session.IPAddress != "" && session.IPAddress != clientIP {
		// IP address changed - invalidate session for security
		s.db.DeleteSession(cookie.Value)
		return nil, fmt.Errorf("session IP mismatch")
	}

	return session, nil
}

// requireAuth middleware checks if user is authenticated
func (s *Server) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Skip auth for shared views
		if isSharedViewRequest(r) {
			next(w, r)
			return
		}

		// Skip auth for setup endpoint
		if r.URL.Path == "/api/auth/setup" {
			next(w, r)
			return
		}

		// Skip auth for status endpoint
		if r.URL.Path == "/api/auth/status" {
			next(w, r)
			return
		}

		// Check if admin exists
		hasAdmin, err := s.db.HasAdmin()
		if err != nil {
			http.Error(w, fmt.Sprintf("error checking admin: %v", err), http.StatusInternalServerError)
			return
		}

		// If no admin exists, allow access (setup required)
		if !hasAdmin {
			next(w, r)
			return
		}

		// Verify session
		session, err := s.getSessionFromRequest(r)
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		// Store session in request context for use in handlers
		r.Header.Set("X-Session-User-ID", fmt.Sprintf("%d", session.UserID))

		next(w, r)
	}
}

// getClientIP extracts the client IP address from the request
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (for proxies/load balancers)
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		ips := strings.Split(forwarded, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

// validateUsername validates username format
func validateUsername(username string) error {
	if len(username) < 3 {
		return fmt.Errorf("username must be at least 3 characters long")
	}
	if len(username) > 50 {
		return fmt.Errorf("username must be no more than 50 characters long")
	}
	// Allow alphanumeric, underscore, hyphen, and dot
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9._-]+$`, username)
	if !matched {
		return fmt.Errorf("username can only contain letters, numbers, underscores, hyphens, and dots")
	}
	return nil
}

// validatePassword validates password complexity
func validatePassword(password string) error {
	if len(password) < 8 {
		return fmt.Errorf("password must be at least 8 characters long")
	}
	if len(password) > 128 {
		return fmt.Errorf("password must be no more than 128 characters long")
	}

	hasUpper := false
	hasLower := false
	hasNumber := false
	hasSpecial := false

	for _, char := range password {
		switch {
		case char >= 'A' && char <= 'Z':
			hasUpper = true
		case char >= 'a' && char <= 'z':
			hasLower = true
		case char >= '0' && char <= '9':
			hasNumber = true
		case strings.ContainsRune("!@#$%^&*()_+-=[]{}|;:,.<>?", char):
			hasSpecial = true
		}
	}

	if !hasUpper {
		return fmt.Errorf("password must contain at least one uppercase letter")
	}
	if !hasLower {
		return fmt.Errorf("password must contain at least one lowercase letter")
	}
	if !hasNumber {
		return fmt.Errorf("password must contain at least one number")
	}
	if !hasSpecial {
		return fmt.Errorf("password must contain at least one special character (!@#$%%^&*()_+-=[]{}|;:,.<>?)")
	}

	return nil
}

