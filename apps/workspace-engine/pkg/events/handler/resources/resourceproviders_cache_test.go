package resources

import (
	"context"
	"encoding/json"
	"testing"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/releasemanager/trace"
	"workspace-engine/pkg/workspace/store"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleResourceProviderSetResources_WithCachedBatch(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-1")

	// Create test resources
	resources := []*oapi.Resource{
		{
			Id:          "res-1",
			Identifier:  "test-resource-1",
			Name:        "Test Resource 1",
			Kind:        "TestKind",
			WorkspaceId: ws.ID,
			Config:      map[string]interface{}{},
			Metadata:    map[string]string{},
			Version:     "v1",
		},
		{
			Id:          "res-2",
			Identifier:  "test-resource-2",
			Name:        "Test Resource 2",
			Kind:        "TestKind",
			WorkspaceId: ws.ID,
			Config:      map[string]interface{}{},
			Metadata:    map[string]string{},
			Version:     "v1",
		},
	}

	providerId := "test-provider-1"

	// Store batch in cache
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Create event with batch reference
	payload := map[string]interface{}{
		"providerId": providerId,
		"batchId":    batchId,
	}

	eventData, err := json.Marshal(payload)
	require.NoError(t, err)

	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        eventData,
	}

	// Handle event
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	require.NoError(t, err)

	// Verify resources were set
	res1, ok := ws.Resources().Get("res-1")
	assert.True(t, ok)
	assert.Equal(t, "test-resource-1", res1.Identifier)

	res2, ok := ws.Resources().Get("res-2")
	assert.True(t, ok)
	assert.Equal(t, "test-resource-2", res2.Identifier)
}

func TestHandleResourceProviderSetResources_BatchNotFound(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-2", workspace.WithTraceStore(trace.NewInMemoryStore()))

	providerId := "test-provider-2"

	// Create event with non-existent batch reference
	payload := map[string]interface{}{
		"providerId": providerId,
		"batchId":    "non-existent-batch-id",
	}

	eventData, err := json.Marshal(payload)
	require.NoError(t, err)

	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        eventData,
	}

	// Handle event should fail
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "batch not found or expired")
}

func TestHandleResourceProviderSetResources_ProviderIdMismatch(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-3", workspace.WithTraceStore(trace.NewInMemoryStore()))

	// Create test resources
	resources := []*oapi.Resource{
		{
			Id:          "res-1",
			Identifier:  "test-resource-1",
			Name:        "Test Resource 1",
			Kind:        "TestKind",
			WorkspaceId: ws.ID,
			Config:      map[string]interface{}{},
			Metadata:    map[string]string{},
			Version:     "v1",
		},
	}

	providerId := "test-provider-original"
	wrongProviderId := "test-provider-wrong"

	// Store batch in cache with original provider ID
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Create event with wrong provider ID
	payload := map[string]interface{}{
		"providerId": wrongProviderId,
		"batchId":    batchId,
	}

	eventData, err := json.Marshal(payload)
	require.NoError(t, err)

	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        eventData,
	}

	// Handle event should fail with provider ID mismatch
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "provider ID mismatch")
}

func TestHandleResourceProviderSetResources_LargeBatch(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-4", workspace.WithTraceStore(trace.NewInMemoryStore()))

	// Create large batch (500 resources)
	resources := make([]*oapi.Resource, 500)
	for i := 0; i < 500; i++ {
		resources[i] = &oapi.Resource{
			Id:          string(rune(i)),
			Identifier:  string(rune(i)),
			Name:        string(rune(i)),
			Kind:        "TestKind",
			WorkspaceId: ws.ID,
			Config:      map[string]interface{}{},
			Metadata:    map[string]string{},
			Version:     "v1",
		}
	}

	providerId := "test-provider-large"

	// Store large batch in cache
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Create event with batch reference
	payload := map[string]interface{}{
		"providerId": providerId,
		"batchId":    batchId,
	}

	eventData, err := json.Marshal(payload)
	require.NoError(t, err)

	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        eventData,
	}

	// Handle event
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	require.NoError(t, err)

	// Verify all resources were set
	allResources := ws.Resources().Items()
	assert.Len(t, allResources, 500)
}

func TestHandleResourceProviderSetResources_WorkspaceIdOverride(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-5", workspace.WithTraceStore(trace.NewInMemoryStore()))

	// Create test resources with wrong workspace ID
	resources := []*oapi.Resource{
		{
			Id:          "res-1",
			Identifier:  "test-resource-1",
			Name:        "Test Resource 1",
			Kind:        "TestKind",
			WorkspaceId: "wrong-workspace-id",
			Config:      map[string]interface{}{},
			Metadata:    map[string]string{},
			Version:     "v1",
		},
	}

	providerId := "test-provider-5"

	// Store batch in cache
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Create event with batch reference
	payload := map[string]interface{}{
		"providerId": providerId,
		"batchId":    batchId,
	}

	eventData, err := json.Marshal(payload)
	require.NoError(t, err)

	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        eventData,
	}

	// Handle event
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	require.NoError(t, err)

	// Verify workspace ID was corrected
	res, ok := ws.Resources().Get("res-1")
	assert.True(t, ok)
	assert.Equal(t, ws.ID, res.WorkspaceId)
}

func TestHandleResourceProviderSetResources_ClaimCheckPattern(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-6", workspace.WithTraceStore(trace.NewInMemoryStore()))

	// Create test resources
	resources := []*oapi.Resource{
		{
			Id:          "res-1",
			Identifier:  "test-resource-1",
			Name:        "Test Resource 1",
			Kind:        "TestKind",
			WorkspaceId: ws.ID,
			Config:      map[string]interface{}{},
			Metadata:    map[string]string{},
			Version:     "v1",
		},
	}

	providerId := "test-provider-6"

	// Store batch in cache
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Create event with batch reference
	payload := map[string]interface{}{
		"providerId": providerId,
		"batchId":    batchId,
	}

	eventData, err := json.Marshal(payload)
	require.NoError(t, err)

	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        eventData,
	}

	// First event should succeed
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	require.NoError(t, err)

	// Second event with same batchId should fail (claim check pattern - one-time use)
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "batch not found or expired")
}

func TestHandleResourceProviderSetResources_InvalidJSON(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-7", workspace.WithTraceStore(trace.NewInMemoryStore()))

	// Create event with invalid JSON
	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        []byte("invalid json"),
	}

	// Handle event should fail
	err := HandleResourceProviderSetResources(ctx, ws, rawEvent)
	assert.Error(t, err)
}

func TestHandleResourceProviderSetResources_ChangesetTracking(t *testing.T) {
	ctx := context.Background()

	// Create workspace
	ws := workspace.New(ctx, "test-workspace-8", workspace.WithTraceStore(trace.NewInMemoryStore()))

	// Create test resources
	resources := []*oapi.Resource{
		{
			Id:          "res-1",
			Identifier:  "test-resource-1",
			Name:        "Test Resource 1",
			Kind:        "TestKind",
			WorkspaceId: ws.ID,
			Config:      map[string]interface{}{},
			Metadata:    map[string]string{},
			Version:     "v1",
		},
	}

	providerId := "test-provider-8"

	// Store batch in cache
	cache := store.GetResourceProviderBatchCache()
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Create event with batch reference
	payload := map[string]interface{}{
		"providerId": providerId,
		"batchId":    batchId,
	}

	eventData, err := json.Marshal(payload)
	require.NoError(t, err)

	rawEvent := handler.RawEvent{
		WorkspaceID: ws.ID,
		EventType:   "resource-provider.set-resources",
		Timestamp:   0,
		Data:        eventData,
	}

	// Handle event
	err = HandleResourceProviderSetResources(ctx, ws, rawEvent)
	require.NoError(t, err)

	// Verify resource was created (changeset tracking happens internally in the workspace)
	resource, exists := ws.Resources().Get("res-1")
	require.True(t, exists, "resource should exist after processing cached batch")
	require.Equal(t, "test-resource-1", resource.Identifier)
	require.Equal(t, "Test Resource 1", resource.Name)
}
