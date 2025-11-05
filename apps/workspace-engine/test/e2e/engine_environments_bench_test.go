package e2e

import (
	"context"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/test/integration"
	c "workspace-engine/test/integration/creators"

	"github.com/google/uuid"
)

// BenchmarkEnvironments_Get benchmarks getting a single environment by ID
func BenchmarkEnvironments_Get(b *testing.B) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environment
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.Name = "test-env"
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	time.Sleep(100 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		_, ok := engine.Workspace().Environments().Get(envID)
		if !ok {
			b.Fatal("Environment not found")
		}
	}
}

// BenchmarkEnvironments_Items benchmarks getting all environments
func BenchmarkEnvironments_Items(b *testing.B) {
	benchmarkEnvironmentsItems(b, 10)
}

// BenchmarkEnvironments_Items_100 benchmarks getting all environments with 100 environments
// Note: May experience database locking issues due to architectural limitation where
// each environment insert triggers a full ReleaseTargets.Recompute that reads all environments.
// This creates O(N²) work and concurrent read/write contention on the environments table.
func BenchmarkEnvironments_Items_100(b *testing.B) {
	benchmarkEnvironmentsItems(b, 100)
}

// BenchmarkEnvironments_Items_500 benchmarks getting all environments with 500 environments  
// Note: May experience database locking issues due to architectural limitation where
// each environment insert triggers a full ReleaseTargets.Recompute that reads all environments.
// This creates O(N²) work and concurrent read/write contention on the environments table.
func BenchmarkEnvironments_Items_500(b *testing.B) {
	benchmarkEnvironmentsItems(b, 500)
}

// benchmarkEnvironmentsItems is a helper function that benchmarks getting all environments
func benchmarkEnvironmentsItems(b *testing.B, numEnvironments int) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environments
	for i := 0; i < numEnvironments; i++ {
		envID := uuid.New().String()
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.Name = fmt.Sprintf("env-%d", i)
		env.ResourceSelector = &oapi.Selector{}
		_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
		engine.PushEvent(ctx, handler.EnvironmentCreate, env)
	}
	
	b.ReportAllocs()

	for b.Loop() {
		items := engine.Workspace().Environments().Items()
		if len(items) < numEnvironments {
			b.Fatalf("Expected at least %d environments, got %d", numEnvironments, len(items))
		}
	}
}

// BenchmarkEnvironments_Upsert benchmarks creating/updating environments
func BenchmarkEnvironments_Upsert(b *testing.B) {
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		b.StopTimer()
		engine := integration.NewTestWorkspace(nil)
		workspaceID := engine.Workspace().ID

		sysID := uuid.New().String()
		sys := c.NewSystem(workspaceID)
		sys.Id = sysID
		engine.PushEvent(ctx, handler.SystemCreate, sys)

		envID := uuid.New().String()
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.Name = "benchmark-env"
		env.ResourceSelector = &oapi.Selector{}
		_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})

		b.StartTimer()
		engine.PushEvent(ctx, handler.EnvironmentCreate, env)
		b.StopTimer()
	}
}

// BenchmarkEnvironments_Resources benchmarks getting resources for an environment
func BenchmarkEnvironments_Resources_10(b *testing.B) {
	benchmarkEnvironmentsResources(b, 10)
}

// BenchmarkEnvironments_Resources_100 benchmarks getting resources for an environment with 100 resources
func BenchmarkEnvironments_Resources_100(b *testing.B) {
	benchmarkEnvironmentsResources(b, 100)
}

// BenchmarkEnvironments_Resources_1000 benchmarks getting resources for an environment with 1000 resources
func BenchmarkEnvironments_Resources_1000(b *testing.B) {
	benchmarkEnvironmentsResources(b, 1000)
}

// BenchmarkEnvironments_Resources_5000 benchmarks getting resources for an environment with 5000 resources
func BenchmarkEnvironments_Resources_5000(b *testing.B) {
	benchmarkEnvironmentsResources(b, 5000)
}

// benchmarkEnvironmentsResources is a helper function that benchmarks getting resources for an environment
func benchmarkEnvironmentsResources(b *testing.B, numResources int) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environment with selector that matches all resources
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.Name = "test-env"
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources
	kinds := []string{"application", "database", "cache", "service", "vpc"}
	tiers := []string{"frontend", "backend", "database"}
	
	for i := 0; i < numResources; i++ {
		resource := c.NewResource(workspaceID)
		resource.Name = fmt.Sprintf("resource-%d", i)
		resource.Kind = kinds[i%len(kinds)]
		resource.Metadata = map[string]string{
			"tier":  tiers[i%len(tiers)],
			"index": fmt.Sprintf("%d", i),
		}
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	// Wait for materialized views to compute
	time.Sleep(500 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		resources, err := engine.Workspace().Environments().Resources(envID)
		if err != nil {
			b.Fatalf("Failed to get resources: %v", err)
		}
		if len(resources) != numResources {
			b.Fatalf("Expected %d resources, got %d", numResources, len(resources))
		}
	}
}

// BenchmarkEnvironments_HasResource benchmarks checking if an environment has a resource
func BenchmarkEnvironments_HasResource(b *testing.B) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environment
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resource
	resourceID := uuid.New().String()
	resource := c.NewResource(workspaceID)
	resource.Id = resourceID
	resource.Name = "test-resource"
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	// Wait for materialized views
	time.Sleep(200 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		has := engine.Workspace().Environments().HasResource(envID, resourceID)
		if !has {
			b.Fatal("Resource should be in environment")
		}
	}
}

// BenchmarkEnvironments_RecomputeResources benchmarks recomputing resources for an environment
func BenchmarkEnvironments_RecomputeResources_100(b *testing.B) {
	benchmarkEnvironmentsRecomputeResources(b, 100)
}

// BenchmarkEnvironments_RecomputeResources_500 benchmarks recomputing resources with 500 resources
func BenchmarkEnvironments_RecomputeResources_500(b *testing.B) {
	benchmarkEnvironmentsRecomputeResources(b, 500)
}

// BenchmarkEnvironments_RecomputeResources_1000 benchmarks recomputing resources with 1000 resources
func BenchmarkEnvironments_RecomputeResources_1000(b *testing.B) {
	benchmarkEnvironmentsRecomputeResources(b, 1000)
}

// benchmarkEnvironmentsRecomputeResources is a helper function that benchmarks recomputing resources
func benchmarkEnvironmentsRecomputeResources(b *testing.B, numResources int) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environment
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "metadata.tier == 'frontend'"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources
	tiers := []string{"frontend", "backend", "database"}
	for i := 0; i < numResources; i++ {
		resource := c.NewResource(workspaceID)
		resource.Name = fmt.Sprintf("resource-%d", i)
		resource.Metadata = map[string]string{
			"tier": tiers[i%len(tiers)],
		}
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	// Wait for initial computation
	time.Sleep(300 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		err := engine.Workspace().Environments().RecomputeResources(ctx, envID)
		if err != nil {
			b.Fatalf("Failed to recompute resources: %v", err)
		}
	}
}

// BenchmarkEnvironments_ApplyResourceUpdate benchmarks applying resource updates to an environment
func BenchmarkEnvironments_ApplyResourceUpdate(b *testing.B) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environment
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resource
	resourceID := uuid.New().String()
	resource := c.NewResource(workspaceID)
	resource.Id = resourceID
	resource.Name = "test-resource"
	engine.PushEvent(ctx, handler.ResourceCreate, resource)

	time.Sleep(200 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		err := engine.Workspace().Environments().ApplyResourceUpdate(ctx, envID, resource)
		if err != nil {
			b.Fatalf("Failed to apply resource update: %v", err)
		}
	}
}

// BenchmarkEnvironments_Remove benchmarks removing environments
func BenchmarkEnvironments_Remove(b *testing.B) {
	ctx := context.Background()

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		b.StopTimer()
		engine := integration.NewTestWorkspace(nil)
		workspaceID := engine.Workspace().ID

		sysID := uuid.New().String()
		sys := c.NewSystem(workspaceID)
		sys.Id = sysID
		engine.PushEvent(ctx, handler.SystemCreate, sys)

		envID := uuid.New().String()
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.ResourceSelector = &oapi.Selector{}
		_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
		engine.PushEvent(ctx, handler.EnvironmentCreate, env)

		time.Sleep(100 * time.Millisecond)

		b.StartTimer()
		engine.Workspace().Environments().Remove(ctx, envID)
		b.StopTimer()

		_, ok := engine.Workspace().Environments().Get(envID)
		if ok {
			b.Fatal("Environment should have been removed")
		}
	}
}

// BenchmarkEnvironments_MultipleResourceSelectors benchmarks environment resource filtering with complex selectors
func BenchmarkEnvironments_MultipleResourceSelectors(b *testing.B) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create multiple environments with different selectors
	envIDs := make([]string, 5)
	selectors := []string{
		"metadata.tier == 'frontend'",
		"metadata.tier == 'backend'",
		"metadata.region == 'us-east-1'",
		"kind == 'database'",
		"metadata.tier == 'frontend' && metadata.region == 'us-east-1'",
	}

	for i := 0; i < 5; i++ {
		envID := uuid.New().String()
		envIDs[i] = envID
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.Name = fmt.Sprintf("env-%d", i)
		env.ResourceSelector = &oapi.Selector{}
		_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: selectors[i]})
		engine.PushEvent(ctx, handler.EnvironmentCreate, env)
	}

	// Create diverse resources
	kinds := []string{"application", "database", "cache", "service", "vpc"}
	tiers := []string{"frontend", "backend", "database"}
	regions := []string{"us-east-1", "us-west-2", "eu-west-1"}

	for i := 0; i < 500; i++ {
		resource := c.NewResource(workspaceID)
		resource.Name = fmt.Sprintf("resource-%d", i)
		resource.Kind = kinds[i%len(kinds)]
		resource.Metadata = map[string]string{
			"tier":   tiers[i%len(tiers)],
			"region": regions[i%len(regions)],
			"index":  fmt.Sprintf("%d", i),
		}
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	// Wait for materialized views
	time.Sleep(1 * time.Second)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Query resources for each environment
		for _, envID := range envIDs {
			resources, err := engine.Workspace().Environments().Resources(envID)
			if err != nil {
				b.Fatalf("Failed to get resources: %v", err)
			}
			// Just access the resources to ensure they're computed
			_ = len(resources)
		}
	}
}

// BenchmarkEnvironments_ConcurrentAccess benchmarks concurrent access to environment resources
func BenchmarkEnvironments_ConcurrentAccess(b *testing.B) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environment
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources
	for i := 0; i < 100; i++ {
		resource := c.NewResource(workspaceID)
		resource.Name = fmt.Sprintf("resource-%d", i)
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	time.Sleep(300 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()

	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			// Mix of different operations
			resources, err := engine.Workspace().Environments().Resources(envID)
			if err != nil {
				b.Errorf("Failed to get resources: %v", err)
			}
			_ = len(resources)

			_, ok := engine.Workspace().Environments().Get(envID)
			if !ok {
				b.Error("Environment not found")
			}

			items := engine.Workspace().Environments().Items()
			_ = len(items)
		}
	})
}

// BenchmarkEnvironments_LargeScale benchmarks environment operations with a large-scale setup
func BenchmarkEnvironments_LargeScale(b *testing.B) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	b.Log("Setting up large-scale environment benchmark...")

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create 50 environments with various selectors
	b.Log("Creating 50 environments...")
	envIDs := make([]string, 50)
	tiers := []string{"frontend", "backend", "database", "middleware", "storage"}
	regions := []string{"us-east-1", "us-west-2", "eu-west-1", "eu-central-1", "ap-south-1"}

	for i := 0; i < 50; i++ {
		envID := uuid.New().String()
		envIDs[i] = envID
		env := c.NewEnvironment(sysID)
		env.Id = envID
		env.Name = fmt.Sprintf("env-%d", i)
		env.ResourceSelector = &oapi.Selector{}

		// Create varied selectors
		if i%5 == 0 {
			_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{
				Cel: fmt.Sprintf("metadata.tier == '%s'", tiers[i%len(tiers)]),
			})
		} else if i%5 == 1 {
			_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{
				Cel: fmt.Sprintf("metadata.region == '%s'", regions[i%len(regions)]),
			})
		} else if i%5 == 2 {
			_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{
				Cel: fmt.Sprintf("metadata.tier == '%s' && metadata.region == '%s'", 
					tiers[i%len(tiers)], regions[i%len(regions)]),
			})
		} else {
			_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: "true"})
		}

		engine.PushEvent(ctx, handler.EnvironmentCreate, env)
	}

	// Create 5000 resources
	b.Log("Creating 5000 resources...")
	kinds := []string{"application", "database", "cache", "service", "vpc", "cluster", "region"}
	
	for i := 0; i < 5000; i++ {
		resource := c.NewResource(workspaceID)
		resource.Name = fmt.Sprintf("resource-%d", i)
		resource.Kind = kinds[i%len(kinds)]
		resource.Metadata = map[string]string{
			"tier":   tiers[i%len(tiers)],
			"region": regions[i%len(regions)],
			"index":  fmt.Sprintf("%d", i),
		}
		resource.Config = map[string]interface{}{
			"replicas": i%10 + 1,
			"version":  fmt.Sprintf("v1.%d.0", i%100),
		}
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	// Wait for all materialized views to compute
	b.Log("Waiting for materialized views to compute...")
	time.Sleep(3 * time.Second)

	environments := engine.Workspace().Environments().Items()
	b.Logf("=== Benchmark Environment Statistics ===")
	b.Logf("Environments: %d", len(environments))
	b.Logf("Resources: %d", engine.Workspace().Store().Repo().Resources.Count())
	b.Logf("========================================")

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		// Test getting all environments
		items := engine.Workspace().Environments().Items()
		if len(items) < 50 {
			b.Fatalf("Expected at least 50 environments, got %d", len(items))
		}

		// Test getting resources for a random environment
		envIdx := i % len(envIDs)
		resources, err := engine.Workspace().Environments().Resources(envIDs[envIdx])
		if err != nil {
			b.Fatalf("Failed to get resources: %v", err)
		}
		_ = len(resources)
	}
}

// BenchmarkEnvironments_ResourceSelectorPerformance benchmarks different types of resource selectors
func BenchmarkEnvironments_ResourceSelectorPerformance_SimpleEquality(b *testing.B) {
	benchmarkEnvironmentsResourceSelector(b, "metadata.tier == 'frontend'", 1000)
}

// BenchmarkEnvironments_ResourceSelectorPerformance_ComplexAnd benchmarks complex AND selectors
func BenchmarkEnvironments_ResourceSelectorPerformance_ComplexAnd(b *testing.B) {
	benchmarkEnvironmentsResourceSelector(b, 
		"metadata.tier == 'frontend' && metadata.region == 'us-east-1' && kind == 'application'", 
		1000)
}

// BenchmarkEnvironments_ResourceSelectorPerformance_ComplexOr benchmarks complex OR selectors
func BenchmarkEnvironments_ResourceSelectorPerformance_ComplexOr(b *testing.B) {
	benchmarkEnvironmentsResourceSelector(b, 
		"metadata.tier == 'frontend' || metadata.tier == 'backend' || kind == 'database'", 
		1000)
}

// benchmarkEnvironmentsResourceSelector is a helper function that benchmarks resource selector performance
func benchmarkEnvironmentsResourceSelector(b *testing.B, selector string, numResources int) {
	ctx := context.Background()
	engine := integration.NewTestWorkspace(nil)
	workspaceID := engine.Workspace().ID

	// Create system
	sysID := uuid.New().String()
	sys := c.NewSystem(workspaceID)
	sys.Id = sysID
	engine.PushEvent(ctx, handler.SystemCreate, sys)

	// Create environment with specific selector
	envID := uuid.New().String()
	env := c.NewEnvironment(sysID)
	env.Id = envID
	env.ResourceSelector = &oapi.Selector{}
	_ = env.ResourceSelector.FromCelSelector(oapi.CelSelector{Cel: selector})
	engine.PushEvent(ctx, handler.EnvironmentCreate, env)

	// Create resources
	kinds := []string{"application", "database", "cache", "service", "vpc"}
	tiers := []string{"frontend", "backend", "database"}
	regions := []string{"us-east-1", "us-west-2", "eu-west-1"}

	for i := 0; i < numResources; i++ {
		resource := c.NewResource(workspaceID)
		resource.Name = fmt.Sprintf("resource-%d", i)
		resource.Kind = kinds[i%len(kinds)]
		resource.Metadata = map[string]string{
			"tier":   tiers[i%len(tiers)],
			"region": regions[i%len(regions)],
		}
		engine.PushEvent(ctx, handler.ResourceCreate, resource)
	}

	time.Sleep(500 * time.Millisecond)

	b.ResetTimer()
	b.ReportAllocs()

	for i := 0; i < b.N; i++ {
		resources, err := engine.Workspace().Environments().Resources(envID)
		if err != nil {
			b.Fatalf("Failed to get resources: %v", err)
		}
		_ = len(resources)
	}
}

