package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/store"

	"github.com/google/uuid"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

// createTestResource creates a test resource with the given ID and workspace
func createTestResource(workspaceID, resourceID, identifier, name string) *oapi.Resource {
	now := time.Now()
	return &oapi.Resource{
		Id:          resourceID,
		WorkspaceId: workspaceID,
		Name:        name,
		Identifier:  identifier,
		Kind:        "test-kind",
		Version:     "v1",
		CreatedAt:   now,
		Config:      map[string]any{},
		Metadata: map[string]string{
			"region": "us-west-1",
			"env":    "prod",
		},
	}
}

// createTestEnvironment creates a test environment with the given ID and system
func createTestEnvironment(systemID, environmentID, name string) *oapi.Environment {
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
		CreatedAt:        time.Now(),
	}
}

func customJobAgentConfig(m map[string]interface{}) oapi.DeploymentJobAgentConfig {
	payload := map[string]interface{}{}
	for k, v := range m {
		payload[k] = v
	}
	payload["type"] = "custom"
	b, err := json.Marshal(payload)
	if err != nil {
		panic(err)
	}

	var cfg oapi.DeploymentJobAgentConfig
	if err := cfg.UnmarshalJSON(b); err != nil {
		panic(err)
	}
	return cfg
}

// createTestDeployment creates a test deployment with the given ID and system
func createTestDeployment(systemID, deploymentID, name string) *oapi.Deployment {
	selector := &oapi.Selector{}
	// Create a selector that matches all resources
	_ = selector.FromCelSelector(oapi.CelSelector{Cel: "true"})

	description := fmt.Sprintf("Test deployment %s", name)
	return &oapi.Deployment{
		Id:               deploymentID,
		Name:             name,
		Slug:             name,
		Description:      &description,
		SystemId:         systemID,
		ResourceSelector: selector,
		JobAgentId:       nil,
		JobAgentConfig:   customJobAgentConfig(nil),
	}
}

// createTestSystem creates a test system with the given workspace and system ID
func createTestSystem(workspaceID string, systemID, name string) *oapi.System {
	return &oapi.System{
		Id:          systemID,
		WorkspaceId: workspaceID,
		Name:        name,
	}
}

// createTestResourceProvider creates a test resource provider
func createTestResourceProvider(workspaceID, providerID, name string) *oapi.ResourceProvider {
	workspaceUUID, _ := uuid.Parse(workspaceID)
	return &oapi.ResourceProvider{
		Id:          providerID,
		WorkspaceId: openapi_types.UUID(workspaceUUID),
		Name:        name,
		CreatedAt:   time.Now(),
		Metadata:    make(map[string]string),
	}
}

// setupBenchmarkWorkspace creates a workspace with the specified number of environments and deployments
// This simulates a realistic scenario where many environments/deployments need to be recomputed
func setupBenchmarkWorkspace(b *testing.B, numEnvironments, numDeployments int) (*workspace.Workspace, string) {
	workspaceID := uuid.New().String()
	ctx := context.Background()

	// Create workspace properly
	ws := workspace.New(ctx, workspaceID)

	// Create system
	systemID := uuid.New().String()
	sys := createTestSystem(workspaceID, systemID, "bench-system")
	if err := ws.Systems().Upsert(ctx, sys); err != nil {
		b.Fatalf("Failed to create system: %v", err)
	}

	// Create multiple environments to trigger expensive recomputation
	for i := 0; i < numEnvironments; i++ {
		environmentID := uuid.New().String()
		envName := fmt.Sprintf("env-%d", i)
		env := createTestEnvironment(systemID, environmentID, envName)

		// Vary selectors for realism
		if i%3 == 0 {
			// Some environments filter by region
			selector := &oapi.Selector{}
			_ = selector.FromJsonSelector(oapi.JsonSelector{
				Json: map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "region",
					"value":    "us-west-1",
				},
			})
			env.ResourceSelector = selector
		} else if i%3 == 1 {
			// Some filter by env metadata
			selector := &oapi.Selector{}
			_ = selector.FromJsonSelector(oapi.JsonSelector{
				Json: map[string]any{
					"type":     "metadata",
					"operator": "equals",
					"key":      "env",
					"value":    "prod",
				},
			})
			env.ResourceSelector = selector
		}
		// else: keep the default match-all selector

		if err := ws.Environments().Upsert(ctx, env); err != nil {
			b.Fatalf("Failed to create environment: %v", err)
		}
	}

	// Create multiple deployments to trigger expensive recomputation
	for i := 0; i < numDeployments; i++ {
		deploymentID := uuid.New().String()
		deploymentName := fmt.Sprintf("deployment-%d", i)
		deployment := createTestDeployment(systemID, deploymentID, deploymentName)

		// Vary selectors for realism
		if i%2 == 0 {
			// Some deployments have selective filters
			selector := &oapi.Selector{}
			_ = selector.FromCelSelector(oapi.CelSelector{
				Cel: `resource.metadata.env == "prod"`,
			})
			deployment.ResourceSelector = selector
		}
		// else: keep the default match-all selector

		if err := ws.Deployments().Upsert(ctx, deployment); err != nil {
			b.Fatalf("Failed to create deployment: %v", err)
		}
	}

	// Create a resource provider
	providerID := "bench-provider"
	provider := createTestResourceProvider(workspaceID, providerID, "Benchmark Provider")
	ws.ResourceProviders().Upsert(ctx, providerID, provider)

	return ws, providerID
}

// BenchmarkHandleResourceProviderSetResources benchmarks the handler with varying numbers of resources
// and a realistic number of environments/deployments that need recomputation
func BenchmarkHandleResourceProviderSetResources(b *testing.B) {
	// Test with different resource counts
	resourceCounts := []int{10, 50, 100, 500, 1000}

	for _, count := range resourceCounts {
		b.Run(fmt.Sprintf("resources_%d_envs_10_deps_10", count), func(b *testing.B) {
			// Setup workspace with 10 environments and 10 deployments
			ws, providerID := setupBenchmarkWorkspace(b, 10, 10)

			// Create resources for the provider
			resources := make([]*oapi.Resource, count)
			for i := range count {
				resourceID := uuid.New().String()
				identifier := fmt.Sprintf("resource-%d", i)
				name := fmt.Sprintf("Resource %d", i)
				res := createTestResource(ws.ID, resourceID, identifier, name)

				// Add variety to metadata for realistic filtering
				switch i % 3 {
				case 0:
					res.Metadata["region"] = "us-east-1"
				case 1:
					res.Metadata["region"] = "eu-west-1"
				case 2:
					res.Metadata["region"] = "us-west-1"
				}

				switch i % 2 {
				case 0:
					res.Metadata["env"] = "prod"
				case 1:
					res.Metadata["env"] = "staging"
				}

				resources[i] = res
			}

			// Get cache for storing resources
			ctx := context.Background()
			cache := store.GetResourceProviderBatchCache()

			// Reset timer to exclude setup time
			b.ResetTimer()

			// Run benchmark
			for b.Loop() {
				// Cache the resources
				batchId, err := cache.Store(ctx, providerID, resources)
				if err != nil {
					b.Fatalf("Failed to cache resources: %v", err)
				}

				// Create event payload with batchId reference
				payload := map[string]interface{}{
					"providerId": providerID,
					"batchId":    batchId,
				}
				payloadBytes, err := json.Marshal(payload)
				if err != nil {
					b.Fatalf("Failed to marshal payload: %v", err)
				}

				event := handler.RawEvent{
					EventType: handler.ResourceProviderSetResources,
					Data:      payloadBytes,
				}

				err = HandleResourceProviderSetResources(ctx, ws, event)
				if err != nil {
					b.Fatalf("HandleResourceProviderSetResources failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkHandleResourceProviderSetResources_ScaleEnvironments benchmarks with varying numbers of environments
func BenchmarkHandleResourceProviderSetResources_ScaleEnvironments(b *testing.B) {
	environmentCounts := []int{5, 25, 50, 100}
	resourceCount := 100

	for _, envCount := range environmentCounts {
		b.Run(fmt.Sprintf("resources_%d_envs_%d_deps_10", resourceCount, envCount), func(b *testing.B) {
			// Setup workspace with varying environments and fixed deployments
			ws, providerID := setupBenchmarkWorkspace(b, envCount, 10)

			// Create resources
			resources := make([]*oapi.Resource, resourceCount)
			for i := 0; i < resourceCount; i++ {
				resourceID := uuid.New().String()
				identifier := fmt.Sprintf("resource-%d", i)
				name := fmt.Sprintf("Resource %d", i)
				res := createTestResource(ws.ID, resourceID, identifier, name)
				resources[i] = res
			}

			// Get cache for storing resources
			ctx := context.Background()
			cache := store.GetResourceProviderBatchCache()

			// Reset timer to exclude setup time
			b.ResetTimer()

			// Run benchmark
			for i := 0; i < b.N; i++ {
				// Cache the resources
				batchId, err := cache.Store(ctx, providerID, resources)
				if err != nil {
					b.Fatalf("Failed to cache resources: %v", err)
				}

				// Create event payload with batchId reference
				payload := map[string]interface{}{
					"providerId": providerID,
					"batchId":    batchId,
				}
				payloadBytes, err := json.Marshal(payload)
				if err != nil {
					b.Fatalf("Failed to marshal payload: %v", err)
				}

				event := handler.RawEvent{
					EventType: handler.ResourceProviderSetResources,
					Data:      payloadBytes,
				}

				err = HandleResourceProviderSetResources(ctx, ws, event)
				if err != nil {
					b.Fatalf("HandleResourceProviderSetResources failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkHandleResourceProviderSetResources_ScaleDeployments benchmarks with varying numbers of deployments
func BenchmarkHandleResourceProviderSetResources_ScaleDeployments(b *testing.B) {
	deploymentCounts := []int{5, 25, 50, 100}
	resourceCount := 100

	for _, depCount := range deploymentCounts {
		b.Run(fmt.Sprintf("resources_%d_envs_10_deps_%d", resourceCount, depCount), func(b *testing.B) {
			// Setup workspace with fixed environments and varying deployments
			ws, providerID := setupBenchmarkWorkspace(b, 10, depCount)

			// Create resources
			resources := make([]*oapi.Resource, resourceCount)
			for i := 0; i < resourceCount; i++ {
				resourceID := uuid.New().String()
				identifier := fmt.Sprintf("resource-%d", i)
				name := fmt.Sprintf("Resource %d", i)
				res := createTestResource(ws.ID, resourceID, identifier, name)
				resources[i] = res
			}

			// Get cache for storing resources
			ctx := context.Background()
			cache := store.GetResourceProviderBatchCache()

			// Reset timer to exclude setup time
			b.ResetTimer()

			// Run benchmark
			for i := 0; i < b.N; i++ {
				// Cache the resources
				batchId, err := cache.Store(ctx, providerID, resources)
				if err != nil {
					b.Fatalf("Failed to cache resources: %v", err)
				}

				// Create event payload with batchId reference
				payload := map[string]interface{}{
					"providerId": providerID,
					"batchId":    batchId,
				}
				payloadBytes, err := json.Marshal(payload)
				if err != nil {
					b.Fatalf("Failed to marshal payload: %v", err)
				}

				event := handler.RawEvent{
					EventType: handler.ResourceProviderSetResources,
					Data:      payloadBytes,
				}

				err = HandleResourceProviderSetResources(ctx, ws, event)
				if err != nil {
					b.Fatalf("HandleResourceProviderSetResources failed: %v", err)
				}
			}
		})
	}
}

// BenchmarkHandleResourceProviderSetResources_HighLoad benchmarks under high load conditions
// This simulates a realistic production scenario with many environments, deployments, and resources
func BenchmarkHandleResourceProviderSetResources_HighLoad(b *testing.B) {
	// Setup workspace with many environments and deployments
	ws, providerID := setupBenchmarkWorkspace(b, 50, 50)

	// Create a large set of resources
	resourceCount := 1000
	resources := make([]*oapi.Resource, resourceCount)
	for i := 0; i < resourceCount; i++ {
		resourceID := uuid.New().String()
		identifier := fmt.Sprintf("resource-%d", i)
		name := fmt.Sprintf("Resource %d", i)
		res := createTestResource(ws.ID, resourceID, identifier, name)

		// Add realistic metadata variety
		regions := []string{"us-east-1", "us-west-1", "eu-west-1", "ap-south-1"}
		res.Metadata["region"] = regions[i%len(regions)]

		envs := []string{"prod", "staging", "dev"}
		res.Metadata["env"] = envs[i%len(envs)]

		res.Metadata["team"] = fmt.Sprintf("team-%d", i%10)

		resources[i] = res
	}

	// Get cache for storing resources
	ctx := context.Background()
	cache := store.GetResourceProviderBatchCache()

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for b.Loop() {
		// Cache the resources
		batchId, err := cache.Store(ctx, providerID, resources)
		if err != nil {
			b.Fatalf("Failed to cache resources: %v", err)
		}

		// Create event payload with batchId reference
		payload := map[string]interface{}{
			"providerId": providerID,
			"batchId":    batchId,
		}
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			b.Fatalf("Failed to marshal payload: %v", err)
		}

		event := handler.RawEvent{
			EventType: handler.ResourceProviderSetResources,
			Data:      payloadBytes,
		}

		err = HandleResourceProviderSetResources(ctx, ws, event)
		if err != nil {
			b.Fatalf("HandleResourceProviderSetResources failed: %v", err)
		}
	}
}

// BenchmarkHandleResourceProviderSetResources_MemoryAllocation benchmarks memory allocations
func BenchmarkHandleResourceProviderSetResources_MemoryAllocation(b *testing.B) {
	// Setup workspace with moderate number of environments and deployments
	ws, providerID := setupBenchmarkWorkspace(b, 20, 20)

	// Create resources
	resourceCount := 500
	resources := make([]*oapi.Resource, resourceCount)
	for i := 0; i < resourceCount; i++ {
		resourceID := uuid.New().String()
		identifier := fmt.Sprintf("resource-%d", i)
		name := fmt.Sprintf("Resource %d", i)
		res := createTestResource(ws.ID, resourceID, identifier, name)
		resources[i] = res
	}

	// Get cache for storing resources
	ctx := context.Background()
	cache := store.GetResourceProviderBatchCache()

	// Report allocations
	b.ReportAllocs()

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for b.Loop() {
		// Cache the resources
		batchId, err := cache.Store(ctx, providerID, resources)
		if err != nil {
			b.Fatalf("Failed to cache resources: %v", err)
		}

		// Create event payload with batchId reference
		payload := map[string]interface{}{
			"providerId": providerID,
			"batchId":    batchId,
		}
		payloadBytes, err := json.Marshal(payload)
		if err != nil {
			b.Fatalf("Failed to marshal payload: %v", err)
		}

		event := handler.RawEvent{
			EventType: handler.ResourceProviderSetResources,
			Data:      payloadBytes,
		}

		err = HandleResourceProviderSetResources(ctx, ws, event)
		if err != nil {
			b.Fatalf("HandleResourceProviderSetResources failed: %v", err)
		}
	}
}

// BenchmarkHandleResourceProviderSetResources_Update benchmarks updating existing resources
// This tests the scenario where resources already exist and are being updated
func BenchmarkHandleResourceProviderSetResources_Update(b *testing.B) {
	// Setup workspace
	ws, providerID := setupBenchmarkWorkspace(b, 10, 10)

	// Create initial set of resources
	resourceCount := 100
	resources := make([]*oapi.Resource, resourceCount)
	for i := 0; i < resourceCount; i++ {
		resourceID := uuid.New().String()
		identifier := fmt.Sprintf("resource-%d", i)
		name := fmt.Sprintf("Resource %d", i)
		res := createTestResource(ws.ID, resourceID, identifier, name)
		resources[i] = res
	}

	// Get cache for storing resources
	ctx := context.Background()
	cache := store.GetResourceProviderBatchCache()

	// Initial SET to create resources
	initialBatchId, err := cache.Store(ctx, providerID, resources)
	if err != nil {
		b.Fatalf("Failed to cache initial resources: %v", err)
	}

	initialPayload := map[string]interface{}{
		"providerId": providerID,
		"batchId":    initialBatchId,
	}
	initialPayloadBytes, err := json.Marshal(initialPayload)
	if err != nil {
		b.Fatalf("Failed to marshal initial payload: %v", err)
	}

	initialEvent := handler.RawEvent{
		EventType: handler.ResourceProviderSetResources,
		Data:      initialPayloadBytes,
	}

	err = HandleResourceProviderSetResources(ctx, ws, initialEvent)
	if err != nil {
		b.Fatalf("Initial HandleResourceProviderSetResources failed: %v", err)
	}

	// Now benchmark updating these resources
	updatedResources := make([]*oapi.Resource, resourceCount)
	for i := 0; i < resourceCount; i++ {
		identifier := fmt.Sprintf("resource-%d", i)
		name := fmt.Sprintf("Updated Resource %d", i)

		// Get existing resource to use same ID
		existingRes, exists := ws.Resources().GetByIdentifier(identifier)
		if !exists {
			b.Fatalf("Resource with identifier %s should exist", identifier)
		}

		res := createTestResource(ws.ID, existingRes.Id, identifier, name)
		res.Metadata["version"] = "2.0"
		updatedResources[i] = res
	}

	// Reset timer to exclude setup time
	b.ResetTimer()

	// Run benchmark
	for i := 0; i < b.N; i++ {
		// Cache the updated resources
		updateBatchId, err := cache.Store(ctx, providerID, updatedResources)
		if err != nil {
			b.Fatalf("Failed to cache updated resources: %v", err)
		}

		updatePayload := map[string]interface{}{
			"providerId": providerID,
			"batchId":    updateBatchId,
		}
		updatePayloadBytes, err := json.Marshal(updatePayload)
		if err != nil {
			b.Fatalf("Failed to marshal update payload: %v", err)
		}

		updateEvent := handler.RawEvent{
			EventType: handler.ResourceProviderSetResources,
			Data:      updatePayloadBytes,
		}

		err = HandleResourceProviderSetResources(ctx, ws, updateEvent)
		if err != nil {
			b.Fatalf("HandleResourceProviderSetResources failed: %v", err)
		}
	}
}
