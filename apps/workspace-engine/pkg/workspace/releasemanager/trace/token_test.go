package trace

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateTraceToken(t *testing.T) {
	traceID := "test-trace-123"
	jobID := "test-job-456"
	duration := 1 * time.Hour

	token := GenerateTraceToken(traceID, jobID, duration)

	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// Token should have two parts separated by dot
	parts := strings.Split(token, ".")
	if len(parts) != 2 {
		t.Errorf("expected token with 2 parts, got %d parts", len(parts))
	}

	// Both parts should be non-empty
	if parts[0] == "" || parts[1] == "" {
		t.Error("token parts should not be empty")
	}
}

func TestGenerateDefaultTraceToken(t *testing.T) {
	traceID := "test-trace-123"
	jobID := "test-job-456"

	token := GenerateDefaultTraceToken(traceID, jobID)

	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// Validate the token
	validated, err := ValidateTraceToken(token)
	if err != nil {
		t.Fatalf("token validation failed: %v", err)
	}

	if validated.TraceID != traceID {
		t.Errorf("expected traceID %s, got %s", traceID, validated.TraceID)
	}

	if validated.JobID != jobID {
		t.Errorf("expected jobID %s, got %s", jobID, validated.JobID)
	}

	// Should expire in approximately 24 hours
	expectedExpiry := time.Now().Add(24 * time.Hour)
	diff := validated.ExpiresAt.Sub(expectedExpiry)
	if diff < -1*time.Second || diff > 1*time.Second {
		t.Errorf("expected expiry around %v, got %v (diff: %v)", expectedExpiry, validated.ExpiresAt, diff)
	}
}

func TestValidateTraceToken_Success(t *testing.T) {
	traceID := "trace-abc"
	jobID := "job-def"
	duration := 1 * time.Hour

	token := GenerateTraceToken(traceID, jobID, duration)

	validated, err := ValidateTraceToken(token)
	if err != nil {
		t.Fatalf("validation failed: %v", err)
	}

	if validated.TraceID != traceID {
		t.Errorf("expected traceID %s, got %s", traceID, validated.TraceID)
	}

	if validated.JobID != jobID {
		t.Errorf("expected jobID %s, got %s", jobID, validated.JobID)
	}

	if validated.ExpiresAt.Before(time.Now()) {
		t.Error("token should not be expired")
	}

	if validated.Signature == "" {
		t.Error("expected non-empty signature")
	}
}

func TestValidateTraceToken_InvalidFormat(t *testing.T) {
	tests := []struct {
		name  string
		token string
	}{
		{"empty token", ""},
		{"no separator", "invalidtoken"},
		{"too many parts", "part1.part2.part3"},
		{"invalid base64", "!!!invalid!!!.signature"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateTraceToken(tt.token)
			if err == nil {
				t.Error("expected validation error, got nil")
			}
		})
	}
}

func TestValidateTraceToken_InvalidSignature(t *testing.T) {
	traceID := "trace-abc"
	jobID := "job-def"

	token := GenerateTraceToken(traceID, jobID, 1*time.Hour)

	// Tamper with the token
	parts := strings.Split(token, ".")
	tamperedToken := parts[0] + ".invalidsignature"

	_, err := ValidateTraceToken(tamperedToken)
	if err == nil {
		t.Error("expected validation error for invalid signature")
	}

	if !strings.Contains(err.Error(), "invalid signature") {
		t.Errorf("expected 'invalid signature' error, got: %v", err)
	}
}

func TestValidateTraceToken_ExpiredToken(t *testing.T) {
	traceID := "trace-abc"
	jobID := "job-def"
	duration := -1 * time.Hour // Already expired

	token := GenerateTraceToken(traceID, jobID, duration)

	_, err := ValidateTraceToken(token)
	if err == nil {
		t.Error("expected validation error for expired token")
	}

	if !strings.Contains(err.Error(), "token expired") {
		t.Errorf("expected 'token expired' error, got: %v", err)
	}
}

func TestValidateTraceToken_InvalidPayload(t *testing.T) {
	// Create a token with invalid payload format
	invalidPayload := "invalid:payload"
	signature := "fakesignature"
	
	// Manually construct invalid token
	token := invalidPayload + "." + signature

	_, err := ValidateTraceToken(token)
	if err == nil {
		t.Error("expected validation error for invalid payload")
	}
}

func TestSetTokenSecret(t *testing.T) {
	originalSecret := tokenSecret

	// Set new secret
	newSecret := []byte("new-test-secret")
	SetTokenSecret(newSecret)

	if string(tokenSecret) != string(newSecret) {
		t.Error("token secret was not updated")
	}

	// Generate token with new secret
	token1 := GenerateTraceToken("trace1", "job1", 1*time.Hour)

	// Restore original secret
	SetTokenSecret(originalSecret)

	// Token generated with new secret should fail validation with old secret
	_, err := ValidateTraceToken(token1)
	if err == nil {
		t.Error("expected validation to fail with different secret")
	}
}

func TestTokenUniqueness(t *testing.T) {
	traceID := "trace-123"
	jobID := "job-456"

	// Sleep at least 1 second to ensure different Unix timestamps
	// (expiresAt.Unix() truncates to seconds)
	token1 := GenerateTraceToken(traceID, jobID, 1*time.Hour)
	time.Sleep(1100 * time.Millisecond) // Ensure we cross a second boundary
	token2 := GenerateTraceToken(traceID, jobID, 1*time.Hour)

	if token1 == token2 {
		t.Error("tokens should be unique even with same IDs due to different expiration times")
	}
}

func TestTokenWithDifferentDurations(t *testing.T) {
	traceID := "trace-123"
	jobID := "job-456"

	tests := []struct {
		name     string
		duration time.Duration
	}{
		{"1 hour", 1 * time.Hour},
		{"24 hours", 24 * time.Hour},
		{"1 week", 7 * 24 * time.Hour},
		{"1 minute", 1 * time.Minute},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token := GenerateTraceToken(traceID, jobID, tt.duration)

			validated, err := ValidateTraceToken(token)
			if err != nil {
				t.Fatalf("validation failed: %v", err)
			}

			expectedExpiry := time.Now().Add(tt.duration)
			diff := validated.ExpiresAt.Sub(expectedExpiry)
			
			// Allow 1 second tolerance
			if diff < -1*time.Second || diff > 1*time.Second {
				t.Errorf("expected expiry around %v, got %v", expectedExpiry, validated.ExpiresAt)
			}
		})
	}
}

func TestTokenRoundTrip(t *testing.T) {
	tests := []struct {
		traceID string
		jobID   string
	}{
		{"simple-trace", "simple-job"},
		{"trace-with-dashes-123", "job-with-dashes-456"},
		{"trace_with_underscores", "job_with_underscores"},
		{"UPPERCASE_TRACE", "UPPERCASE_JOB"},
		{"trace.with.dots", "job.with.dots"},
	}

	for _, tt := range tests {
		t.Run(tt.traceID+"/"+tt.jobID, func(t *testing.T) {
			token := GenerateTraceToken(tt.traceID, tt.jobID, 1*time.Hour)

			validated, err := ValidateTraceToken(token)
			if err != nil {
				t.Fatalf("validation failed: %v", err)
			}

			if validated.TraceID != tt.traceID {
				t.Errorf("expected traceID %s, got %s", tt.traceID, validated.TraceID)
			}

			if validated.JobID != tt.jobID {
				t.Errorf("expected jobID %s, got %s", tt.jobID, validated.JobID)
			}
		})
	}
}

func TestTokenExpirationBoundary(t *testing.T) {
	traceID := "trace-123"
	jobID := "job-456"
	
	// Create token that expires in 1 second
	token := GenerateTraceToken(traceID, jobID, 1*time.Second)

	// Should be valid immediately
	_, err := ValidateTraceToken(token)
	if err != nil {
		t.Errorf("token should be valid immediately: %v", err)
	}

	// Wait for expiration
	time.Sleep(2 * time.Second)

	// Should now be expired
	_, err = ValidateTraceToken(token)
	if err == nil {
		t.Error("token should be expired")
	}
}

func TestTraceTokenStruct(t *testing.T) {
	token := &TraceToken{
		TraceID:   "trace-123",
		JobID:     "job-456",
		ExpiresAt: time.Now().Add(1 * time.Hour),
		Signature: "test-signature",
	}

	if token.TraceID == "" {
		t.Error("TraceID should not be empty")
	}

	if token.JobID == "" {
		t.Error("JobID should not be empty")
	}

	if token.ExpiresAt.IsZero() {
		t.Error("ExpiresAt should not be zero")
	}

	if token.Signature == "" {
		t.Error("Signature should not be empty")
	}
}

