package db

import (
	"testing"
)

func TestDBWorkspaces_GetWorkspaceIDs(t *testing.T) {
	// Create multiple workspaces
	workspaceID1, conn1 := setupTestWithWorkspace(t)
	workspaceID2, conn2 := setupTestWithWorkspace(t)
	workspaceID3, conn3 := setupTestWithWorkspace(t)
	// Note: conn.Release() is handled by t.Cleanup in setupTestWithWorkspace

	// Get all workspace IDs
	workspaceIDs, err := GetWorkspaceIDs(t.Context())
	if err != nil {
		t.Fatalf("expected no errors, got %v", err)
	}

	// Verify all three workspaces are in the result
	if len(workspaceIDs) < 3 {
		t.Fatalf("expected at least 3 workspaces, got %d", len(workspaceIDs))
	}

	// Check that our test workspaces are included
	foundWorkspaces := make(map[string]bool)
	for _, id := range workspaceIDs {
		foundWorkspaces[id] = true
	}

	if !foundWorkspaces[workspaceID1] {
		t.Fatalf("workspace %s not found in results", workspaceID1)
	}
	if !foundWorkspaces[workspaceID2] {
		t.Fatalf("workspace %s not found in results", workspaceID2)
	}
	if !foundWorkspaces[workspaceID3] {
		t.Fatalf("workspace %s not found in results", workspaceID3)
	}

	// Keep conn references to avoid "declared but not used" errors
	_ = conn1
	_ = conn2
	_ = conn3
}
