package jobdispatch

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestIsRetryableError validates that the isRetryableError function correctly
// classifies errors as retryable or non-retryable for the ArgoCD dispatcher.
func TestIsRetryableError(t *testing.T) {
	tests := []struct {
		name      string
		err       error
		retryable bool
	}{
		{
			name:      "nil error",
			err:       nil,
			retryable: false,
		},

		// HTTP status codes indicating transient failures
		{
			name:      "502 bad gateway",
			err:       errors.New("HTTP 502 Bad Gateway"),
			retryable: true,
		},
		{
			name:      "503 service unavailable",
			err:       errors.New("HTTP 503 Service Unavailable"),
			retryable: true,
		},
		{
			name:      "504 gateway timeout",
			err:       errors.New("HTTP 504 Gateway Timeout"),
			retryable: true,
		},
		{
			name:      "connection refused",
			err:       errors.New("connection refused"),
			retryable: true,
		},
		{
			name:      "connection reset",
			err:       errors.New("connection reset by peer"),
			retryable: true,
		},
		{
			name:      "timeout",
			err:       errors.New("request timeout"),
			retryable: true,
		},
		{
			name:      "temporarily unavailable",
			err:       errors.New("service temporarily unavailable"),
			retryable: true,
		},

		// ArgoCD destination/cluster errors (race condition when destination is being synced)
		// Based on actual production error logs
		{
			name:      "unable to find destination server",
			err:       errors.New("unable to find destination server: there are 2 clusters with the same name"),
			retryable: true,
		},
		{
			name:      "application destination spec is invalid",
			err:       errors.New("application destination spec for my-app is invalid: unable to find destination server"),
			retryable: true,
		},
		{
			name:      "argocd rpc error - destination spec invalid",
			err:       errors.New("rpc error: code = InvalidArgument desc = application destination spec for wandb-cluster-datadog is invalid: unable to find destination server: there are 2 clusters with the same name: [https://34.23.213.231 https://34.73.236.204]"),
			retryable: true,
		},
		{
			name:      "mixed case - unable to find destination",
			err:       errors.New("Unable To Find Destination Server"),
			retryable: true,
		},

		// Non-retryable errors
		{
			name:      "authentication error",
			err:       errors.New("authentication failed: invalid token"),
			retryable: false,
		},
		{
			name:      "permission denied",
			err:       errors.New("permission denied"),
			retryable: false,
		},
		{
			name:      "invalid application spec",
			err:       errors.New("invalid application spec: missing required field"),
			retryable: false,
		},
		{
			name:      "namespace not found",
			err:       errors.New("namespace not found"),
			retryable: false,
		},
		{
			name:      "400 bad request",
			err:       errors.New("HTTP 400 Bad Request"),
			retryable: false,
		},
		{
			name:      "401 unauthorized",
			err:       errors.New("HTTP 401 Unauthorized"),
			retryable: false,
		},
		{
			name:      "empty error message",
			err:       errors.New(""),
			retryable: false,
		},
		{
			name:      "error with cluster in different context",
			err:       errors.New("failed to connect to cluster manager"),
			retryable: false,
		},
		{
			name:      "error with destination in different context",
			err:       errors.New("destination folder not writable"),
			retryable: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isRetryableError(tt.err)
			assert.Equal(t, tt.retryable, result,
				"Expected isRetryableError(%v) = %v, got %v",
				tt.err, tt.retryable, result)
		})
	}
}

// BenchmarkIsRetryableError benchmarks the error classification function
func BenchmarkIsRetryableError(b *testing.B) {
	testErrors := []error{
		errors.New("cluster not found"),
		errors.New("destination does not exist"),
		errors.New("HTTP 503 Service Unavailable"),
		errors.New("authentication failed"),
		nil,
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		for _, err := range testErrors {
			_ = isRetryableError(err)
		}
	}
}
