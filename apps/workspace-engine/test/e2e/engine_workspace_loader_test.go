package e2e

import (
	"context"
	"fmt"
	"os"
	"testing"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/kafka"
)

func TestEngine_WorkspaceLoader_SingleWorkspace(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-loader-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create and save a workspace
	workspaceID := "test-workspace-1"
	ws := workspace.New(workspaceID)
	ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
		LastApplied:   42,
		LastTimestamp: 1234567890,
	}

	if err := ws.SaveToStorage(ctx, storage, workspaceID+".gob"); err != nil {
		t.Fatalf("failed to save workspace: %v", err)
	}

	// Determine which partition this workspace belongs to
	numPartitions := int32(4)
	workspacePartition := kafka.PartitionForWorkspace(workspaceID, numPartitions)

	// Create a mock discoverer that returns our workspace ID only for its partition
	discoverer := func(ctx context.Context, targetPartition int32, numPartitions int32) ([]string, error) {
		// Return workspace only if it belongs to the requested partition
		if kafka.PartitionForWorkspace(workspaceID, numPartitions) == targetPartition {
			return []string{workspaceID}, nil
		}
		return []string{}, nil
	}

	// Create workspace loader
	loader := workspace.CreateWorkspaceLoader(storage, discoverer)

	// Load workspaces for the assigned partition
	assignedPartitions := []int32{workspacePartition}
	if err := loader(ctx, assignedPartitions, numPartitions); err != nil {
		t.Fatalf("failed to load workspaces: %v", err)
	}

	// Verify workspace was loaded
	if !workspace.HasWorkspace(workspaceID) {
		t.Fatal("workspace was not loaded")
	}

	loadedWs := workspace.GetWorkspace(workspaceID)
	if loadedWs.ID != workspaceID {
		t.Errorf("workspace ID mismatch: expected %s, got %s", workspaceID, loadedWs.ID)
	}

	// Verify KafkaProgress was restored
	tp := kafka.TopicPartition{Topic: "events", Partition: 0}
	if progress, ok := loadedWs.KafkaProgress[tp]; !ok {
		t.Error("KafkaProgress not found")
	} else if progress.LastApplied != 42 {
		t.Errorf("LastApplied mismatch: expected 42, got %d", progress.LastApplied)
	}
}

func TestEngine_WorkspaceLoader_MultipleWorkspaces(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-loader-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create and save multiple workspaces
	numPartitions := int32(4)
	workspaceIDs := []string{
		"workspace-alpha",
		"workspace-beta",
		"workspace-gamma",
		"workspace-delta",
		"workspace-epsilon",
	}

	// Map workspaces to their partitions
	workspacePartitions := make(map[string]int32)
	for _, wsID := range workspaceIDs {
		ws := workspace.New(wsID)
		ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
			LastApplied:   int64(len(wsID)), // Use length as unique identifier
			LastTimestamp: 1234567890,
		}

		if err := ws.SaveToStorage(ctx, storage, wsID+".gob"); err != nil {
			t.Fatalf("failed to save workspace %s: %v", wsID, err)
		}

		partition := kafka.PartitionForWorkspace(wsID, numPartitions)
		workspacePartitions[wsID] = partition
	}

	// Choose partitions to load (e.g., partitions 0 and 2)
	assignedPartitions := []int32{0, 2}

	// Determine which workspaces should be loaded
	expectedWorkspaces := make(map[string]bool)
	for wsID, partition := range workspacePartitions {
		for _, assigned := range assignedPartitions {
			if partition == assigned {
				expectedWorkspaces[wsID] = true
				break
			}
		}
	}

	// Create a mock discoverer that returns workspace IDs only for the requested partition
	discoverer := func(ctx context.Context, targetPartition int32, numPartitions int32) ([]string, error) {
		var result []string
		for _, wsID := range workspaceIDs {
			if kafka.PartitionForWorkspace(wsID, numPartitions) == targetPartition {
				result = append(result, wsID)
			}
		}
		return result, nil
	}

	// Create and execute workspace loader
	loader := workspace.CreateWorkspaceLoader(storage, discoverer)
	if err := loader(ctx, assignedPartitions, numPartitions); err != nil {
		t.Fatalf("failed to load workspaces: %v", err)
	}

	// Verify only expected workspaces were loaded
	for wsID := range expectedWorkspaces {
		if !workspace.HasWorkspace(wsID) {
			t.Errorf("expected workspace %s to be loaded (partition %d)", wsID, workspacePartitions[wsID])
		}
	}

	// Verify unexpected workspaces were NOT loaded
	for _, wsID := range workspaceIDs {
		if !expectedWorkspaces[wsID] {
			// Note: GetWorkspace creates a new workspace if it doesn't exist,
			// so we need to check HasWorkspace instead
			if workspace.HasWorkspace(wsID) {
				t.Errorf("workspace %s should not be loaded (partition %d not in assigned)", wsID, workspacePartitions[wsID])
			}
		}
	}
}

func TestEngine_WorkspaceLoader_PartitionAssignment(t *testing.T) {
	// Test that the partition assignment logic is consistent
	numPartitions := int32(8)

	testCases := []struct {
		workspaceID       string
		expectedPartition int32
	}{
		// These values are based on Murmur3 hash
		// The actual partition depends on the hash function
		{"workspace-1", kafka.PartitionForWorkspace("workspace-1", numPartitions)},
		{"workspace-2", kafka.PartitionForWorkspace("workspace-2", numPartitions)},
		{"workspace-3", kafka.PartitionForWorkspace("workspace-3", numPartitions)},
	}

	for _, tc := range testCases {
		partition := kafka.PartitionForWorkspace(tc.workspaceID, numPartitions)

		if partition != tc.expectedPartition {
			t.Errorf("workspace %s: expected partition %d, got %d", tc.workspaceID, tc.expectedPartition, partition)
		}

		// Verify partition is within valid range
		if partition < 0 || partition >= numPartitions {
			t.Errorf("workspace %s: partition %d is out of range [0, %d)", tc.workspaceID, partition, numPartitions)
		}

		// Verify consistency - calling multiple times should return same result
		for i := 0; i < 10; i++ {
			p := kafka.PartitionForWorkspace(tc.workspaceID, numPartitions)
			if p != partition {
				t.Errorf("partition assignment is not consistent for %s: got %d, expected %d", tc.workspaceID, p, partition)
			}
		}
	}
}

func TestEngine_WorkspaceLoader_EmptyAssignment(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-loader-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create a mock discoverer
	discoverer := func(ctx context.Context, targetPartition int32, numPartitions int32) ([]string, error) {
		return []string{}, nil
	}

	// Create workspace loader
	loader := workspace.CreateWorkspaceLoader(storage, discoverer)

	// Load workspaces with empty assignment
	assignedPartitions := []int32{}
	if err := loader(ctx, assignedPartitions, int32(4)); err != nil {
		t.Fatalf("failed to load workspaces with empty assignment: %v", err)
	}

	// This should succeed and not load any workspaces
	// GetAllWorkspaceIds might return workspaces, but they shouldn't be loaded from storage
}

func TestEngine_WorkspaceLoader_AllPartitions(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-loader-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create and save multiple workspaces
	numPartitions := int32(4)
	workspaceIDs := []string{
		"workspace-all-1",
		"workspace-all-2",
		"workspace-all-3",
		"workspace-all-4",
	}

	for _, wsID := range workspaceIDs {
		ws := workspace.New(wsID)
		ws.KafkaProgress[kafka.TopicPartition{Topic: "events", Partition: 0}] = kafka.KafkaProgress{
			LastApplied:   int64(len(wsID)),
			LastTimestamp: 1234567890,
		}

		if err := ws.SaveToStorage(ctx, storage, wsID+".gob"); err != nil {
			t.Fatalf("failed to save workspace %s: %v", wsID, err)
		}
	}

	// Create a mock discoverer that returns workspaces for the requested partition
	discoverer := func(ctx context.Context, targetPartition int32, numPartitions int32) ([]string, error) {
		var result []string
		for _, wsID := range workspaceIDs {
			if kafka.PartitionForWorkspace(wsID, numPartitions) == targetPartition {
				result = append(result, wsID)
			}
		}
		return result, nil
	}

	// Create workspace loader and load ALL partitions
	loader := workspace.CreateWorkspaceLoader(storage, discoverer)
	assignedPartitions := []int32{0, 1, 2, 3} // All partitions

	if err := loader(ctx, assignedPartitions, numPartitions); err != nil {
		t.Fatalf("failed to load workspaces: %v", err)
	}

	// Verify all workspaces were loaded
	for _, wsID := range workspaceIDs {
		if !workspace.HasWorkspace(wsID) {
			t.Errorf("workspace %s should be loaded", wsID)
		}
	}
}

func TestEngine_WorkspaceLoader_MissingWorkspaceFile(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-loader-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create a mock discoverer that returns a workspace that doesn't exist on disk
	missingWorkspaceID := "missing-workspace"
	numPartitions := int32(4)
	partition := kafka.PartitionForWorkspace(missingWorkspaceID, numPartitions)

	discoverer := func(ctx context.Context, targetPartition int32, numPartitions int32) ([]string, error) {
		// Only return the missing workspace for its assigned partition
		if targetPartition == partition {
			return []string{missingWorkspaceID}, nil
		}
		return []string{}, nil
	}

	// Create workspace loader
	loader := workspace.CreateWorkspaceLoader(storage, discoverer)

	// Try to load - this should return an error since the file doesn't exist
	assignedPartitions := []int32{partition}
	err = loader(ctx, assignedPartitions, numPartitions)

	if err == nil {
		t.Fatal("expected error when loading missing workspace file, got nil")
	}

	// Verify error message contains workspace ID
	if !contains(err.Error(), missingWorkspaceID) {
		t.Errorf("error message should mention missing workspace ID: %v", err)
	}
}

func TestEngine_WorkspaceLoader_DiscovererError(t *testing.T) {
	ctx := context.Background()

	// Create temporary directory for storage
	tempDir, err := os.MkdirTemp("", "workspace-loader-test-*")
	if err != nil {
		t.Fatalf("failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	storage := workspace.NewFileStorage(tempDir)

	// Create a mock discoverer that returns an error
	expectedError := fmt.Errorf("discoverer error")
	discoverer := func(ctx context.Context, targetPartition int32, numPartitions int32) ([]string, error) {
		return nil, expectedError
	}

	// Create workspace loader
	loader := workspace.CreateWorkspaceLoader(storage, discoverer)

	// Try to load - this should return the discoverer error
	assignedPartitions := []int32{0}
	err = loader(ctx, assignedPartitions, int32(4))

	if err == nil {
		t.Fatal("expected error from discoverer, got nil")
	}

	// Verify we get the expected error (either from discoverer or from GetAssignedWorkspaceIDs)
	if !contains(err.Error(), "failed to discover workspace IDs") && !contains(err.Error(), "discoverer error") {
		t.Errorf("error should indicate failure to discover workspace IDs: %v", err)
	}
}

// Helper function to check if a string contains a substring
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && len(substr) > 0 && indexOfString(s, substr) >= 0))
}

func indexOfString(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
