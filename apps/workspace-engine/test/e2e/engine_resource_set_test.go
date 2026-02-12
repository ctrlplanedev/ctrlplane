package e2e

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
	integration "workspace-engine/test/integration"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// Helper function to cache resources and send set event
func cacheAndSetResources(t *testing.T, engine *integration.TestWorkspace, ctx context.Context, providerID string, resources []*oapi.Resource) {
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerID, resources)
	require.NoError(t, err)

	setResourcesPayload := map[string]interface{}{
		"providerId": providerID,
		"batchId":    batchId,
	}
	engine.PushEvent(ctx, handler.ResourceProviderSetResources, setResourcesPayload)
}

func TestEngine_ResourceProviderSetResources(t *testing.T) {
	providerID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Test Provider"),
		),
	)

	ctx := context.Background()

	// Create initial resources via SET
	resource1 := &oapi.Resource{
		Identifier: "res-1",
		Name:       "Resource 1",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	resource2 := &oapi.Resource{
		Identifier: "res-2",
		Name:       "Resource 2",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	// Initial SET with resources 1 and 2
	cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{resource1, resource2})

	// Verify both resources exist
	ws := engine.Workspace()
	r1, exists := ws.Resources().GetByIdentifier("res-1")
	require.True(t, exists, "res-1 should exist")
	require.NotNil(t, r1.ProviderId, "res-1 should have a providerId")
	require.Equal(t, providerID, *r1.ProviderId, "res-1 should have correct providerId")
	require.False(t, r1.CreatedAt.IsZero(), "res-1 should have CreatedAt")
	require.WithinDuration(t, time.Now(), r1.CreatedAt, 5*time.Second, "res-1 CreatedAt should be recent")

	r2, exists := ws.Resources().GetByIdentifier("res-2")
	require.True(t, exists, "res-2 should exist")
	require.NotNil(t, r2.ProviderId, "res-2 should have a providerId")
	require.Equal(t, providerID, *r2.ProviderId, "res-2 should have correct providerId")
	require.False(t, r2.CreatedAt.IsZero(), "res-2 should have CreatedAt")

	// Store original timestamps for later comparison
	r2OriginalCreatedAt := r2.CreatedAt

	// Now SET with only resource 2 and a new resource 3
	resource3 := &oapi.Resource{
		Identifier: "res-3",
		Name:       "Resource 3",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{resource2, resource3})

	// Verify resource 1 was deleted
	_, exists = ws.Resources().GetByIdentifier("res-1")
	require.False(t, exists, "res-1 should have been deleted")

	// Verify resource 2 still exists and was updated
	r2Updated, exists := ws.Resources().GetByIdentifier("res-2")
	require.True(t, exists, "res-2 should still exist")
	require.Equal(t, r2OriginalCreatedAt, r2Updated.CreatedAt, "res-2 CreatedAt should not change on update")
	require.NotNil(t, r2Updated.UpdatedAt, "res-2 should have UpdatedAt after update")
	require.True(t, r2Updated.UpdatedAt.After(r2OriginalCreatedAt), "res-2 UpdatedAt should be after CreatedAt")

	// Verify resource 3 was created
	r3, exists := ws.Resources().GetByIdentifier("res-3")
	require.True(t, exists, "res-3 should exist")
	require.NotNil(t, r3.ProviderId, "res-3 should have a providerId")
	require.Equal(t, providerID, *r3.ProviderId, "res-3 should have correct providerId")
	require.False(t, r3.CreatedAt.IsZero(), "res-3 should have CreatedAt")
	require.WithinDuration(t, time.Now(), r3.CreatedAt, 5*time.Second, "res-3 CreatedAt should be recent")
}

func TestEngine_ResourceProviderSetResources_OnlyDeletesProviderResources(t *testing.T) {
	provider1ID := uuid.New().String()
	provider2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(provider1ID),
			integration.ProviderName("Provider 1"),
		),
		integration.WithResourceProvider(
			integration.ProviderID(provider2ID),
			integration.ProviderName("Provider 2"),
		),
	)

	// Create resources for both providers
	provider1Resource := &oapi.Resource{
		Identifier: "p1-res-1",
		Name:       "Provider 1 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	provider2Resource := &oapi.Resource{
		Identifier: "p2-res-1",
		Name:       "Provider 2 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	ctx := context.Background()
	cacheAndSetResources(t, engine, ctx, provider1ID, []*oapi.Resource{provider1Resource})
	cacheAndSetResources(t, engine, ctx, provider2ID, []*oapi.Resource{provider2Resource})

	// Verify both exist
	ws := engine.Workspace()
	_, exists := ws.Resources().GetByIdentifier("p1-res-1")
	require.True(t, exists, "p1-res-1 should exist")

	_, exists = ws.Resources().GetByIdentifier("p2-res-1")
	require.True(t, exists, "p2-res-1 should exist")

	// SET provider1 with empty list
	cacheAndSetResources(t, engine, ctx, provider1ID, []*oapi.Resource{})

	// Verify provider1's resource was deleted
	_, exists = ws.Resources().GetByIdentifier("p1-res-1")
	require.False(t, exists, "p1-res-1 should have been deleted")

	// Verify provider2's resource still exists (not affected)
	_, exists = ws.Resources().GetByIdentifier("p2-res-1")
	require.True(t, exists, "p2-res-1 should still exist")
}

func TestEngine_ResourceProviderSetResources_CannotStealFromOtherProvider(t *testing.T) {
	provider1ID := uuid.New().String()
	provider2ID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(provider1ID),
			integration.ProviderName("Provider 1"),
		),
		integration.WithResourceProvider(
			integration.ProviderID(provider2ID),
			integration.ProviderName("Provider 2"),
		),
	)

	// Provider 1 creates a resource with identifier "shared-resource"
	provider1Resource := &oapi.Resource{
		Identifier: "shared-resource",
		Name:       "Provider 1 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	ctx := context.Background()
	cacheAndSetResources(t, engine, ctx, provider1ID, []*oapi.Resource{provider1Resource})

	ws := engine.Workspace()
	res, exists := ws.Resources().GetByIdentifier("shared-resource")
	require.True(t, exists, "resource with identifier 'shared-resource' should exist")
	require.NotNil(t, res.ProviderId, "resource should have a providerId")
	require.Equal(t, provider1ID, *res.ProviderId, "resource should belong to provider1")
	originalID := res.Id

	// Provider 2 tries to create a resource with the same identifier
	// This should be ignored because the resource already belongs to provider1
	provider2Resource := &oapi.Resource{
		Identifier: "shared-resource", // Same identifier
		Name:       "Provider 2 Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	cacheAndSetResources(t, engine, ctx, provider2ID, []*oapi.Resource{provider2Resource})

	// Verify the original resource still belongs to provider1
	res, exists = ws.Resources().GetByIdentifier("shared-resource")
	require.True(t, exists, "resource with identifier 'shared-resource' should still exist")
	require.Equal(t, originalID, res.Id, "resource ID should not have changed")
	require.NotNil(t, res.ProviderId, "resource should have a providerId")
	require.Equal(t, provider1ID, *res.ProviderId, "resource should still belong to provider1")
	require.Equal(t, "Provider 1 Resource", res.Name, "resource name should not have changed")
}

func TestEngine_ResourceProviderSetResources_CanClaimUnownedResources(t *testing.T) {
	providerID := uuid.New().String()
	unownedResID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Provider 1"),
		),
		integration.WithResource(
			integration.ResourceID(unownedResID),
			integration.ResourceIdentifier("unowned-resource"),
			integration.ResourceName("Unowned Resource"),
		),
	)

	ws := engine.Workspace()

	// Verify the resource exists but has no provider
	unownedRes, exists := ws.Resources().Get(unownedResID)
	require.True(t, exists, "unowned-res should exist")
	require.Nil(t, unownedRes.ProviderId, "resource should have no provider")

	// Provider claims the resource by using the same identifier in SET
	claimedResource := &oapi.Resource{
		Identifier: "unowned-resource", // Same identifier
		Name:       "Now Owned Resource",
		Kind:       "TestKind",
		Config:     map[string]interface{}{},
		Metadata:   map[string]string{},
	}

	ctx := context.Background()
	cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{claimedResource})

	// Verify the original resource is now owned by the provider
	claimedRes, exists := ws.Resources().Get(unownedResID)
	require.True(t, exists, "unowned-res should still exist (with same ID)")
	require.NotNil(t, claimedRes.ProviderId, "resource should now have a providerId")
	require.Equal(t, providerID, *claimedRes.ProviderId, "resource should now belong to provider")
	require.Equal(t, "Now Owned Resource", claimedRes.Name, "resource name should be updated")
	require.Equal(t, unownedRes.CreatedAt, claimedRes.CreatedAt, "resource CreatedAt should not change when claimed")
	require.NotNil(t, claimedRes.UpdatedAt, "resource should have UpdatedAt after being claimed")
	require.True(t, claimedRes.UpdatedAt.After(claimedRes.CreatedAt), "resource UpdatedAt should be after CreatedAt")
}

func TestEngine_ResourceProviderSetResources_TimestampBehavior(t *testing.T) {
	providerID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Test Provider"),
		),
	)

	// Create a resource
	resource1 := &oapi.Resource{
		Identifier: "timestamp-test",
		Name:       "Timestamp Test",
		Kind:       "TestKind",
		Config:     map[string]any{},
		Metadata:   map[string]string{},
	}

	ctx := context.Background()
	cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{resource1})

	ws := engine.Workspace()
	r1, exists := ws.Resources().GetByIdentifier("timestamp-test")
	require.True(t, exists, "resource should exist")
	require.False(t, r1.CreatedAt.IsZero(), "resource should have CreatedAt")

	originalCreatedAt := r1.CreatedAt
	originalID := r1.Id

	// Small delay to ensure different timestamps
	time.Sleep(10 * time.Millisecond)

	// Update the resource with same identifier
	resource1Updated := &oapi.Resource{
		Identifier: "timestamp-test",
		Name:       "Timestamp Test Updated",
		Kind:       "TestKind",
		Config:     map[string]interface{}{"updated": true},
		Metadata:   map[string]string{},
	}

	cacheAndSetResources(t, engine, ctx, providerID, []*oapi.Resource{resource1Updated})

	r1Updated, exists := ws.Resources().GetByIdentifier("timestamp-test")
	require.True(t, exists, "resource should still exist")
	require.Equal(t, originalID, r1Updated.Id, "resource ID should not change")
	require.Equal(t, originalCreatedAt, r1Updated.CreatedAt, "CreatedAt should not change on update")
	require.NotNil(t, r1Updated.UpdatedAt, "UpdatedAt should be set after update")
	require.True(t, r1Updated.UpdatedAt.After(originalCreatedAt), "UpdatedAt should be after CreatedAt")
	require.Equal(t, "Timestamp Test Updated", r1Updated.Name, "resource name should be updated")
}

// Cached Batch Pattern Tests - These test the new Ristretto cache-based approach for large payloads

func TestEngine_ResourceProviderSetResources_CachedBatch(t *testing.T) {
	providerID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Test Provider"),
		),
	)

	ctx := context.Background()

	// Create resources to cache
	resources := []*oapi.Resource{
		{
			Identifier: "cached-res-1",
			Name:       "Cached Resource 1",
			Kind:       "TestKind",
			Config:     map[string]interface{}{},
			Metadata:   map[string]string{},
		},
		{
			Identifier: "cached-res-2",
			Name:       "Cached Resource 2",
			Kind:       "TestKind",
			Config:     map[string]interface{}{},
			Metadata:   map[string]string{},
		},
	}

	// Store batch in cache (simulating API layer)
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerID, resources)
	require.NoError(t, err, "should store batch in cache")
	require.NotEmpty(t, batchId, "should return a batchId")

	// Send event with batchId reference (tiny Kafka message)
	setResourcesPayload := map[string]interface{}{
		"providerId": providerID,
		"batchId":    batchId,
	}
	engine.PushEvent(ctx, handler.ResourceProviderSetResources, setResourcesPayload)

	// Verify resources were created from cached batch
	ws := engine.Workspace()
	r1, exists := ws.Resources().GetByIdentifier("cached-res-1")
	require.True(t, exists, "cached-res-1 should exist")
	require.NotNil(t, r1.ProviderId, "cached-res-1 should have a providerId")
	require.Equal(t, providerID, *r1.ProviderId, "cached-res-1 should have correct providerId")

	r2, exists := ws.Resources().GetByIdentifier("cached-res-2")
	require.True(t, exists, "cached-res-2 should exist")
	require.NotNil(t, r2.ProviderId, "cached-res-2 should have a providerId")
	require.Equal(t, providerID, *r2.ProviderId, "cached-res-2 should have correct providerId")
}

func TestEngine_ResourceProviderSetResources_CachedBatch_LargePayload(t *testing.T) {
	providerID := uuid.New().String()

	engine := integration.NewTestWorkspace(
		t,
		integration.WithResourceProvider(
			integration.ProviderID(providerID),
			integration.ProviderName("Test Provider Large"),
		),
	)

	ctx := context.Background()

	// Create 200 resources (simulating large payload that exceeds Kafka limits)
	resources := make([]*oapi.Resource, 200)
	for i := 0; i < 200; i++ {
		resources[i] = &oapi.Resource{
			Identifier: string(rune(65 + i)), // A, B, C, ...
			Name:       string(rune(65 + i)),
			Kind:       "TestKind",
			Config: map[string]interface{}{
				"index": i,
			},
			Metadata: map[string]string{
				"seq": string(rune(48 + (i % 10))),
			},
		}
	}

	// Store large batch in cache
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerID, resources)
	require.NoError(t, err, "should store large batch in cache")

	// Send small event with batchId reference
	setResourcesPayload := map[string]interface{}{
		"providerId": providerID,
		"batchId":    batchId,
	}
	engine.PushEvent(ctx, handler.ResourceProviderSetResources, setResourcesPayload)

	// Verify all 200 resources were created
	ws := engine.Workspace()
	allResources := ws.Resources().Items()
	providerResources := 0
	for _, res := range allResources {
		if res.ProviderId != nil && *res.ProviderId == providerID {
			providerResources++
		}
	}
	require.Equal(t, 200, providerResources, "should have created all 200 resources")
}

// Note: Batch not found errors are tested in unit tests (resourceproviders_cache_test.go)
// E2E tests with PushEvent cannot test error conditions since it calls t.Fatalf on errors

// Note: Provider ID mismatch and one-time use errors are tested in unit tests
// E2E tests with PushEvent cannot test error conditions since it calls t.Fatalf on errors
