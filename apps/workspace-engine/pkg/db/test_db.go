package db

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
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

// setupTestWithWorkspace creates a workspace, verifies DB connection, and automatically cleans up after test
// Returns: workspaceID string
func setupTestWithWorkspace(t *testing.T) (string, *pgxpool.Conn) {
	t.Helper()
	ctx := context.Background()

	// Verify database connection
	pool := GetPool(ctx)
	if err := pool.Ping(ctx); err != nil {
		t.Skipf("Database not available (tried %s): %v", os.Getenv("POSTGRES_URL"), err)
	}

	// Create unique workspace ID
	workspaceID := uuid.New().String()

	// Insert workspace (using temporary connection)
	tempDB, err := GetDB(ctx)
	if err != nil {
		t.Fatalf("Failed to get DB connection: %v", err)
	}
	defer tempDB.Release()

	_, err = tempDB.Exec(ctx,
		"INSERT INTO workspace (id, name, slug) VALUES ($1, $2, $3)",
		workspaceID, "test_"+workspaceID[:8], "test-"+workspaceID[:8])
	if err != nil {
		t.Fatalf("Failed to create test workspace: %v", err)
	}

	// Get a fresh connection for the test to use
	testDB, err := GetDB(ctx)
	if err != nil {
		t.Fatalf("Failed to get test DB connection: %v", err)
	}

	// Register cleanup (runs automatically even if test fails)
	t.Cleanup(func() {
		testDB.Release()

		cleanupDB, err := GetDB(ctx)
		if err != nil {
			t.Logf("Cleanup: Failed to get DB connection: %v", err)
			return
		}
		defer cleanupDB.Release()

		// Delete workspace (cascades to related tables)
		_, err = cleanupDB.Exec(ctx, "DELETE FROM workspace WHERE id = $1", workspaceID)
		if err != nil {
			t.Logf("Cleanup: Failed to delete workspace: %v", err)
		}
	})

	return workspaceID, testDB
}

func compareStrPtr(t *testing.T, actual *string, expected *string) {
	if actual == nil && expected == nil {
		return
	}
	if actual == nil || expected == nil {
		t.Fatalf("expected %v, got %v", expected, actual)
	}
	if *actual != *expected {
		t.Fatalf("expected %v, got %v", expected, actual)
	}
}
