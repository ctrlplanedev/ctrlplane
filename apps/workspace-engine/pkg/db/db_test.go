package db

import (
	"os"
	"testing"
)

// Test utilities for database testing
//
// Usage:
//   func TestMyFeature(t *testing.T) {
//       ctx, workspaceID := setupTestWithWorkspace(t)
//       // workspace is created and will auto-cleanup
//       // ... your test code ...
//   }

const DEFAULT_TEST_POSTGRES_URL = "postgresql://ctrlplane:ctrlplane@localhost:5432/ctrlplane"

// TestMain runs before all tests and sets up the test database
func TestMain(m *testing.M) {
	// Set default POSTGRES_URL if not already set
	if os.Getenv("POSTGRES_URL") == "" {
		os.Setenv("POSTGRES_URL", DEFAULT_TEST_POSTGRES_URL)
	}

	// Run tests
	code := m.Run()

	// Cleanup
	Close()
	os.Exit(code)
}
