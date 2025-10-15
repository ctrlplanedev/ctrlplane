package store

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/google/uuid"
)

// createTestResource creates a test resource with the given ID and workspace
func createTestResource(workspaceID, resourceID, name string) *oapi.Resource {
	now := time.Now()
	return &oapi.Resource{
		Id:          resourceID,
		WorkspaceId: workspaceID,
		Name:        name,
		Identifier:  name,
		Kind:        "test-kind",
		Version:     "v1",
		CreatedAt:   now,
		Config:      map[string]any{},
		Metadata: map[string]string{
			"region": "us-west-1",
			"env":    "test",
		},
	}
}

// createTestEnvironment creates a test environment with the given ID and system
func createTestEnvironment(systemID, environmentID, name string) *oapi.Environment {
	now := time.Now().Format(time.RFC3339)
	selector := &oapi.Selector{}
	// Create a selector that matches all resources (name starts with empty string)
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "name",
			"operator": "starts-with",
			"value":    "",
		},
	})

	description := fmt.Sprintf("Test environment %s", name)
	return &oapi.Environment{
		Id:               environmentID,
		Name:             name,
		Description:      &description,
		SystemId:         systemID,
		ResourceSelector: selector,
		CreatedAt:        now,
	}
}

// createTestSystem creates a test system with the given workspace and system ID
func createTestSystem(workspaceID, systemID, name string) *oapi.System {
	return &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

// setupBenchmarkStore creates a store with the specified number of resources
// It directly populates the repository to avoid triggering recomputes during setup
func setupBenchmarkStore(b *testing.B, workspaceID string, numResources int) (*Store, string) {
	st := New()

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	st.repo.Systems.Set(systemID, sys)

	// Create environment
	environmentID := uuid.New().String()
	env := createTestEnvironment(systemID, environmentID, "bench-environment")
	st.repo.Environments.Set(environmentID, env)

	// Create resources directly in repository
	for i := 0; i < numResources; i++ {
		resourceID := uuid.New().String()
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)

		// Add some variety to metadata for realistic filtering
		switch i % 3 {
		case 0:
			res.Metadata["region"] = "us-east-1"
		case 1:
			res.Metadata["region"] = "eu-west-1"
		}

		switch i % 2 {
		case 0:
			res.Metadata["priority"] = "high"
		case 1:
			res.Metadata["priority"] = "low"
		}

		st.repo.Resources.Set(resourceID, res)
	}

	return st, environmentID
}

// BenchmarkEnvironmentResourceRecomputeFunc benchmarks the recompute function with varying numbers of resources
func BenchmarkEnvironmentResourceRecomputeFunc(b *testing.B) {
	workspaceID := uuid.New().String()

	// Test with different resource counts to see how it scales
	resourceCounts := []int{10, 100, 1000, 5000, 10000}

	for _, count := range resourceCounts {
		b.Run(fmt.Sprintf("resources_%d", count), func(b *testing.B) {
			// Setup store with resources
			st, environmentID := setupBenchmarkStore(b, workspaceID, count)

			// Get the recompute function
			recomputeFunc := st.Environments.environmentResourceRecomputeFunc(environmentID)

			// Reset timer to exclude setup time
			b.ResetTimer()

			// Run benchmark
			for range b.N {
				ctx := context.Background()
				_, err := recomputeFunc(ctx)
				if err != nil {
					b.Fatalf("Recompute failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkEnvironmentResourceRecomputeFunc_Parallel benchmarks the recompute function with concurrent calls
func BenchmarkEnvironmentResourceRecomputeFunc_Parallel(b *testing.B) {
	workspaceID := uuid.New().String()
	resourceCount := 1000

	// Setup store with resources
	st, environmentID := setupBenchmarkStore(b, workspaceID, resourceCount)

	// Get the recompute function
	recomputeFunc := st.Environments.environmentResourceRecomputeFunc(environmentID)

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark in parallel
	b.RunParallel(func(pb *testing.PB) {
		ctx := context.Background()
		for pb.Next() {
			_, err := recomputeFunc(ctx)
			if err != nil {
				b.Fatalf("Recompute failed: %v", err)
			}
		}
	})
}

// BenchmarkEnvironmentResourceRecomputeFunc_SelectiveSelector benchmarks with a more selective selector
func BenchmarkEnvironmentResourceRecomputeFunc_SelectiveSelector(b *testing.B) {
	workspaceID := uuid.New().String()
	ctx := context.Background()
	resourceCount := 1000

	st := New()

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	st.repo.Systems.Set(systemID, sys)

	// Create environment with selective selector (only matches high priority resources)
	environmentID := uuid.New().String()
	env := createTestEnvironment(systemID, environmentID, "bench-environment")

	// Override selector to only match high priority resources
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"type":     "metadata",
			"operator": "equals",
			"key":      "priority",
			"value":    "high",
		},
	})
	env.ResourceSelector = selector
	st.repo.Environments.Set(environmentID, env)

	// Create resources (50% will match the selector)
	for i := 0; i < resourceCount; i++ {
		resourceID := uuid.New().String()
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)

		if i%2 == 0 {
			res.Metadata["priority"] = "high"
		} else {
			res.Metadata["priority"] = "low"
		}

		st.repo.Resources.Set(resourceID, res)
	}

	// Get the recompute function
	recomputeFunc := st.Environments.environmentResourceRecomputeFunc(environmentID)

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		result, err := recomputeFunc(ctx)
		if err != nil {
			b.Fatalf("Recompute failed: %v", err)
		}

		// Verify we got the expected number of resources (approximately 50%)
		if i == 0 { // Only verify on first iteration to avoid overhead
			expectedCount := resourceCount / 2
			actualCount := len(result)
			if actualCount < expectedCount-10 || actualCount > expectedCount+10 {
				b.Logf("Expected ~%d resources, got %d", expectedCount, actualCount)
			}
		}
	}
}

// BenchmarkEnvironmentResourceRecomputeFunc_ComplexSelector benchmarks with a complex AND condition selector
func BenchmarkEnvironmentResourceRecomputeFunc_ComplexSelector(b *testing.B) {
	workspaceID := uuid.New().String()
	ctx := context.Background()
	resourceCount := 1000

	st := New()

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	st.repo.Systems.Set(systemID, sys)

	// Create environment with complex selector (high priority AND us-east-1 region)
	environmentID := uuid.New().String()
	env := createTestEnvironment(systemID, environmentID, "bench-environment")

	// Override selector with AND condition
	selector := &oapi.Selector{}
	_ = selector.FromJsonSelector(oapi.JsonSelector{
		Json: map[string]any{
			"operator": "and",
			"conditions": []any{
				map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "priority",
					"value":    "high",
				},
				map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "region",
					"value":    "us-east-1",
				},
			},
		},
	})
	env.ResourceSelector = selector
	st.repo.Environments.Set(environmentID, env)

	// Create resources with varying metadata
	for i := 0; i < resourceCount; i++ {
		resourceID := uuid.New().String()
		resourceName := fmt.Sprintf("resource-%d", i)
		res := createTestResource(workspaceID, resourceID, resourceName)

		if i%3 == 0 {
			res.Metadata["region"] = "us-east-1"
		} else if i%3 == 1 {
			res.Metadata["region"] = "eu-west-1"
		} else {
			res.Metadata["region"] = "us-west-1"
		}

		if i%2 == 0 {
			res.Metadata["priority"] = "high"
		} else {
			res.Metadata["priority"] = "low"
		}

		st.repo.Resources.Set(resourceID, res)
	}

	// Get the recompute function
	recomputeFunc := st.Environments.environmentResourceRecomputeFunc(environmentID)

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		_, err := recomputeFunc(ctx)
		if err != nil {
			b.Fatalf("Recompute failed: %v", err)
		}
	}
}

// BenchmarkEnvironmentResourceRecomputeFunc_MemoryAllocation benchmarks memory allocations
func BenchmarkEnvironmentResourceRecomputeFunc_MemoryAllocation(b *testing.B) {
	workspaceID := uuid.New().String()
	resourceCount := 1000

	// Setup store with resources
	st, environmentID := setupBenchmarkStore(b, workspaceID, resourceCount)

	// Get the recompute function
	recomputeFunc := st.Environments.environmentResourceRecomputeFunc(environmentID)

	// Reset timer and report allocations

	b.ReportAllocs()

	// Run benchmark
	for b.Loop() {
		ctx := context.Background()
		_, err := recomputeFunc(ctx)
		if err != nil {
			b.Fatalf("Recompute failed: %v", err)
		}
	}
}
