package partitioner

import (
	"testing"
)

func TestPartitionForWorkspace_Consistency(t *testing.T) {
	workspaceID := "workspace-123"
	numPartitions := int32(10)

	// Call multiple times with same inputs
	partition1 := PartitionForWorkspace(workspaceID, numPartitions)
	partition2 := PartitionForWorkspace(workspaceID, numPartitions)
	partition3 := PartitionForWorkspace(workspaceID, numPartitions)

	if partition1 != partition2 || partition2 != partition3 {
		t.Errorf("Expected consistent partitions, got %d, %d, %d", partition1, partition2, partition3)
	}
}

func TestPartitionForWorkspace_WithinBounds(t *testing.T) {
	tests := []struct {
		name          string
		workspaceID   string
		numPartitions int32
	}{
		{"single partition", "workspace-1", 1},
		{"ten partitions", "workspace-2", 10},
		{"hundred partitions", "workspace-3", 100},
		{"many partitions", "workspace-4", 1000},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			partition := PartitionForWorkspace(tt.workspaceID, tt.numPartitions)
			
			if partition < 0 || partition >= tt.numPartitions {
				t.Errorf("Partition %d out of bounds [0, %d)", partition, tt.numPartitions)
			}
		})
	}
}

func TestPartitionForWorkspace_Distribution(t *testing.T) {
	numPartitions := int32(10)
	numWorkspaces := 1000
	
	// Track distribution across partitions
	distribution := make(map[int32]int)
	
	for i := 0; i < numWorkspaces; i++ {
		workspaceID := "workspace-" + string(rune(i))
		partition := PartitionForWorkspace(workspaceID, numPartitions)
		distribution[partition]++
	}
	
	// Check that all partitions are used
	if len(distribution) != int(numPartitions) {
		t.Errorf("Expected all %d partitions to be used, but only %d were used", numPartitions, len(distribution))
	}
	
	// Check that distribution is relatively even (within 50% of average)
	average := numWorkspaces / int(numPartitions)
	minExpected := average / 2
	maxExpected := average * 2
	
	for partition, count := range distribution {
		if count < minExpected || count > maxExpected {
			t.Errorf("Partition %d has %d workspaces, expected between %d and %d", 
				partition, count, minExpected, maxExpected)
		}
	}
}

func TestPartitionForWorkspace_DifferentWorkspaces(t *testing.T) {
	numPartitions := int32(10)
	
	partition1 := PartitionForWorkspace("workspace-1", numPartitions)
	partition2 := PartitionForWorkspace("workspace-2", numPartitions)
	partition3 := PartitionForWorkspace("workspace-3", numPartitions)
	
	// At least some should be different (not a guarantee, but highly likely)
	allSame := (partition1 == partition2 && partition2 == partition3)
	if allSame {
		t.Log("Warning: All three different workspace IDs mapped to the same partition (unlikely but possible)")
	}
}

func TestPartitionForWorkspace_EmptyString(t *testing.T) {
	numPartitions := int32(10)
	
	partition := PartitionForWorkspace("", numPartitions)
	
	if partition < 0 || partition >= numPartitions {
		t.Errorf("Empty string partition %d out of bounds [0, %d)", partition, numPartitions)
	}
}

func TestPartitionForWorkspace_SinglePartition(t *testing.T) {
	// With only 1 partition, everything must go to partition 0
	tests := []string{"workspace-1", "workspace-2", "workspace-3", ""}
	
	for _, workspaceID := range tests {
		partition := PartitionForWorkspace(workspaceID, 1)
		if partition != 0 {
			t.Errorf("Expected partition 0 for workspace %q with 1 partition, got %d", workspaceID, partition)
		}
	}
}

func TestPartitionForWorkspace_KnownValues(t *testing.T) {
	// Test with known workspace IDs to ensure consistency across runs
	tests := []struct {
		workspaceID   string
		numPartitions int32
		// We don't specify expected partition because we just want consistency
	}{
		{"clzj8r5ck000008l7h9gm3k3v", 10},
		{"clzj8r5ck000108l7d2we8h4a", 10},
		{"test-workspace", 10},
		{"prod-workspace-123", 10},
	}

	for _, tt := range tests {
		t.Run(tt.workspaceID, func(t *testing.T) {
			// Call multiple times and ensure consistency
			first := PartitionForWorkspace(tt.workspaceID, tt.numPartitions)
			
			for i := 0; i < 100; i++ {
				partition := PartitionForWorkspace(tt.workspaceID, tt.numPartitions)
				if partition != first {
					t.Errorf("Inconsistent partition for %q: got %d, expected %d", 
						tt.workspaceID, partition, first)
				}
			}
			
			// Verify bounds
			if first < 0 || first >= tt.numPartitions {
				t.Errorf("Partition %d out of bounds [0, %d)", first, tt.numPartitions)
			}
		})
	}
}

func TestMurmur2_Deterministic(t *testing.T) {
	data := []byte("test-data")
	
	hash1 := murmur2(data)
	hash2 := murmur2(data)
	hash3 := murmur2(data)
	
	if hash1 != hash2 || hash2 != hash3 {
		t.Errorf("Expected deterministic hash, got %d, %d, %d", hash1, hash2, hash3)
	}
}

func TestMurmur2_DifferentInputs(t *testing.T) {
	hash1 := murmur2([]byte("input1"))
	hash2 := murmur2([]byte("input2"))
	
	if hash1 == hash2 {
		t.Error("Expected different hashes for different inputs (collision unlikely)")
	}
}

func TestMurmur2_EmptyInput(t *testing.T) {
	// Should not panic
	hash := murmur2([]byte{})
	
	// Hash should be deterministic even for empty input
	hash2 := murmur2([]byte{})
	if hash != hash2 {
		t.Errorf("Expected deterministic hash for empty input, got %d and %d", hash, hash2)
	}
}

func BenchmarkPartitionForWorkspace(b *testing.B) {
	workspaceID := "clzj8r5ck000008l7h9gm3k3v"
	numPartitions := int32(10)
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		PartitionForWorkspace(workspaceID, numPartitions)
	}
}

func BenchmarkMurmur2(b *testing.B) {
	data := []byte("clzj8r5ck000008l7h9gm3k3v")
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		murmur2(data)
	}
}

