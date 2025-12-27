package main

import (
	"net/http"
	"strings"
)

// Security middleware and helpers

// isSharedViewRequest checks if the request is from a shared view page
func isSharedViewRequest(r *http.Request) bool {
	referer := r.Header.Get("Referer")
	if referer == "" {
		return false
	}
	return strings.Contains(referer, "/shared") || strings.Contains(referer, "?share=")
}

// addSecurityHeaders adds security headers to responses
func addSecurityHeaders(w http.ResponseWriter) {
	// Prevent clickjacking
	w.Header().Set("X-Frame-Options", "SAMEORIGIN")
	// Prevent MIME type sniffing
	w.Header().Set("X-Content-Type-Options", "nosniff")
	// XSS Protection
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	// Referrer Policy
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	// Content Security Policy (adjust as needed)
	w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; font-src 'self' https://cdnjs.cloudflare.com; img-src 'self' data:; connect-src 'self'")
}
