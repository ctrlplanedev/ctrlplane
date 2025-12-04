package db

import (
	"testing"
	"time"

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

func TestDBWorkspaces_GetLatestWorkspaceSnapshots(t *testing.T) {
	ctx := t.Context()

	// Create 3 workspaces
	ws1ID, _ := setupTestWithWorkspace(t)
	ws2ID, _ := setupTestWithWorkspace(t)
	ws3ID, _ := setupTestWithWorkspace(t)

	// Create multiple snapshots for workspace 1 (verify it returns latest by offset)
	ws1Snapshots := []*WorkspaceSnapshot{
		{
			WorkspaceID:   ws1ID,
			Path:          "ws1-v1.gob",
			Timestamp:     time.Now().Add(-10 * time.Hour), // Oldest time
			Partition:     0,
			Offset:        100, // Highest offset - should be returned
			NumPartitions: 3,
		},
		{
			WorkspaceID:   ws1ID,
			Path:          "ws1-v2.gob",
			Timestamp:     time.Now(), // Newest time
			Partition:     0,
			Offset:        50, // Lower offset
			NumPartitions: 3,
		},
		{
			WorkspaceID:   ws1ID,
			Path:          "ws1-v3.gob",
			Timestamp:     time.Now().Add(-5 * time.Hour),
			Partition:     0,
			Offset:        75,
			NumPartitions: 3,
		},
	}

	for _, snapshot := range ws1Snapshots {
		if err := WriteWorkspaceSnapshot(ctx, snapshot); err != nil {
			t.Fatalf("Failed to write snapshot for ws1: %v", err)
		}
	}

	// Create snapshots for workspace 2
	ws2Snapshot := &WorkspaceSnapshot{
		WorkspaceID:   ws2ID,
		Path:          "ws2.gob",
		Timestamp:     time.Now(),
		Partition:     1,
		Offset:        200,
		NumPartitions: 3,
	}

	if err := WriteWorkspaceSnapshot(ctx, ws2Snapshot); err != nil {
		t.Fatalf("Failed to write snapshot for ws2: %v", err)
	}

	// Workspace 3 has no snapshots

	// Test 1: Get snapshots for workspaces with snapshots
	snapshots, err := GetLatestWorkspaceSnapshots(ctx, []string{ws1ID, ws2ID})
	if err != nil {
		t.Fatalf("Failed to get latest snapshots: %v", err)
	}

	if len(snapshots) != 2 {
		t.Fatalf("Expected 2 snapshots, got %d", len(snapshots))
	}

	// Verify workspace 1 returns snapshot with HIGHEST offset (not newest timestamp)
	ws1Snapshot := snapshots[ws1ID]
	if ws1Snapshot == nil {
		t.Fatal("No snapshot returned for ws1")
		return
	}
	if ws1Snapshot.Offset != 100 {
		t.Fatalf("Expected ws1 snapshot with offset 100 (highest), got %d", ws1Snapshot.Offset)
	}
	if ws1Snapshot.Path != "ws1-v1.gob" {
		t.Fatalf("Expected ws1-v1.gob (highest offset), got %s", ws1Snapshot.Path)
	}

	// Verify workspace 2 returns its snapshot
	ws2SnapshotResult := snapshots[ws2ID]
	if ws2SnapshotResult == nil {
		t.Fatal("No snapshot returned for ws2")
		return
	}
	if ws2SnapshotResult.Offset != 200 {
		t.Fatalf("Expected ws2 snapshot with offset 200, got %d", ws2SnapshotResult.Offset)
	}

	// Test 2: Get snapshots including workspace with no snapshots
	snapshots, err = GetLatestWorkspaceSnapshots(ctx, []string{ws1ID, ws2ID, ws3ID})
	if err != nil {
		t.Fatalf("Failed to get snapshots with ws3: %v", err)
	}

	// Should still return 2 (ws3 has no snapshots)
	if len(snapshots) != 2 {
		t.Fatalf("Expected 2 snapshots (ws3 has none), got %d", len(snapshots))
	}

	// Test 3: Empty workspace ID array
	snapshots, err = GetLatestWorkspaceSnapshots(ctx, []string{})
	if err != nil {
		t.Fatalf("Expected no error for empty array, got %v", err)
	}
	if snapshots != nil {
		t.Fatalf("Expected nil for empty array, got %d snapshots", len(snapshots))
	}

	// Test 4: Non-existent workspace IDs
	fakeID := uuid.New().String()
	snapshots, err = GetLatestWorkspaceSnapshots(ctx, []string{fakeID})
	if err != nil {
		t.Fatalf("Expected no error for non-existent workspace, got %v", err)
	}
	if len(snapshots) != 0 {
		t.Fatalf("Expected 0 snapshots for non-existent workspace, got %d", len(snapshots))
	}
}
