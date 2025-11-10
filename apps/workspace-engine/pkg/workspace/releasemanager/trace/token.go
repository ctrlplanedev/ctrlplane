package trace

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"strings"
	"time"
)

// tokenSecret should be loaded from config/environment in production
var tokenSecret = []byte("ctrlplane-trace-secret-change-in-production")

// TraceToken represents an authenticated token for external trace recording
type TraceToken struct {
	TraceID   string
	JobID     string
	ExpiresAt time.Time
	Signature string
}

// GenerateTraceToken creates a scoped token for a specific job to record traces
func GenerateTraceToken(traceID, jobID string, duration time.Duration) string {
	expiresAt := time.Now().Add(duration)

	// Create payload: traceID:jobID:expiresAt
	payload := fmt.Sprintf("%s:%s:%d", traceID, jobID, expiresAt.Unix())

	// Sign the payload
	h := hmac.New(sha256.New, tokenSecret)
	h.Write([]byte(payload))
	signature := base64.URLEncoding.EncodeToString(h.Sum(nil))

	// Token format: payload.signature
	token := fmt.Sprintf("%s.%s", base64.URLEncoding.EncodeToString([]byte(payload)), signature)

	return token
}

// GenerateDefaultTraceToken creates a token with default 24-hour expiration
func GenerateDefaultTraceToken(traceID, jobID string) string {
	return GenerateTraceToken(traceID, jobID, 24*time.Hour)
}

// ValidateTraceToken validates a trace token and returns the trace ID and job ID
func ValidateTraceToken(token string) (*TraceToken, error) {
	// Split token into payload and signature
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}

	payloadEncoded := parts[0]
	signatureProvided := parts[1]

	// Decode payload
	payloadBytes, err := base64.URLEncoding.DecodeString(payloadEncoded)
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding: %w", err)
	}
	payload := string(payloadBytes)

	// Verify signature
	h := hmac.New(sha256.New, tokenSecret)
	h.Write([]byte(payload))
	signatureExpected := base64.URLEncoding.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(signatureProvided), []byte(signatureExpected)) {
		return nil, fmt.Errorf("invalid signature")
	}

	// Parse payload: traceID:jobID:expiresAt
	payloadParts := strings.Split(payload, ":")
	if len(payloadParts) != 3 {
		return nil, fmt.Errorf("invalid payload format")
	}

	traceID := payloadParts[0]
	jobID := payloadParts[1]

	var expiresAtUnix int64
	if _, err := fmt.Sscanf(payloadParts[2], "%d", &expiresAtUnix); err != nil {
		return nil, fmt.Errorf("invalid expiration time: %w", err)
	}

	expiresAt := time.Unix(expiresAtUnix, 0)

	// Check if token is expired
	if time.Now().After(expiresAt) {
		return nil, fmt.Errorf("token expired")
	}

	return &TraceToken{
		TraceID:   traceID,
		JobID:     jobID,
		ExpiresAt: expiresAt,
		Signature: signatureProvided,
	}, nil
}

// SetTokenSecret allows setting a custom secret for token generation
// This should be called during application initialization with a secure secret
func SetTokenSecret(secret []byte) {
	tokenSecret = secret
}
