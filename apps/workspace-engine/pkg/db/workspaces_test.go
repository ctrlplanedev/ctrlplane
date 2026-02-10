package db

import (
	"testing"

	"github.com/google/uuid"
)

func TestDBWorkspaces_WorkspaceExists(t *testing.T) {
	workspaceID, conn := setupTestWithWorkspace(t)
	_ = conn // Avoid "declared but not used" error

	// Test that the workspace exists
	exists, err := WorkspaceExists(t.Context(), workspaceID)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if !exists {
		t.Fatalf("expected workspace %s to exist", workspaceID)
	}

	// Test that a non-existent workspace returns false
	nonExistentID := uuid.New().String()
	exists, err = WorkspaceExists(t.Context(), nonExistentID)
	if err != nil {
		t.Fatalf("expected no error for non-existent workspace, got %v", err)
	}
	if exists {
		t.Fatalf("expected workspace %s to not exist, but it does", nonExistentID)
	}
}
