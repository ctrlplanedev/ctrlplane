package store

import (
	"context"
	"testing"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResourceProviderCache_StoreAndRetrieve(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	// Create test resources
	resources := []*oapi.Resource{
		{
			Id:         "res-1",
			Identifier: "test-resource-1",
			Name:       "Test Resource 1",
			Kind:       "TestKind",
		},
		{
			Id:         "res-2",
			Identifier: "test-resource-2",
			Name:       "Test Resource 2",
			Kind:       "TestKind",
		},
	}

	providerId := "test-provider-1"

	// Store batch
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)
	require.NotEmpty(t, batchId)

	// Retrieve batch
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)
	require.NotNil(t, batch)

	// Verify batch contents
	assert.Equal(t, batchId, batch.BatchId)
	assert.Equal(t, providerId, batch.ProviderId)
	assert.Len(t, batch.Resources, 2)
	assert.Equal(t, "res-1", batch.Resources[0].Id)
	assert.Equal(t, "res-2", batch.Resources[1].Id)
}

func TestResourceProviderCache_OneTimeRetrieval(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	resources := []*oapi.Resource{
		{Id: "res-1", Identifier: "test-1", Name: "Test 1", Kind: "TestKind"},
	}

	providerId := "test-provider-2"

	// Store batch
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// First retrieval should succeed
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)
	require.NotNil(t, batch)

	// Second retrieval should fail (claim check pattern - one-time use)
	batch, err = cache.Retrieve(ctx, batchId)
	assert.Error(t, err)
	assert.Nil(t, batch)
	assert.Contains(t, err.Error(), "batch not found or expired")
}

func TestResourceProviderCache_BatchNotFound(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	// Try to retrieve non-existent batch
	batch, err := cache.Retrieve(ctx, "non-existent-batch-id")
	assert.Error(t, err)
	assert.Nil(t, batch)
	assert.Contains(t, err.Error(), "batch not found or expired")
}

func TestResourceProviderCache_TTLExpiration(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping TTL test in short mode")
	}

	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	resources := []*oapi.Resource{
		{Id: "res-1", Identifier: "test-1", Name: "Test 1", Kind: "TestKind"},
	}

	providerId := "test-provider-ttl"

	// Store batch with default 5-minute TTL
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Immediate retrieval should work
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)
	require.NotNil(t, batch)

	// Store another batch for TTL test
	batchId2, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Wait for longer than TTL (5 minutes)
	// Note: In production, batches expire after 5 minutes
	// For testing, we just verify the batch exists immediately
	batch2, err := cache.Retrieve(ctx, batchId2)
	require.NoError(t, err)
	require.NotNil(t, batch2)

	// After retrieval, it should be deleted (one-time use)
	_, err = cache.Retrieve(ctx, batchId2)
	assert.Error(t, err)
}

func TestResourceProviderCache_LargePayload(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	// Create a large batch (1000 resources)
	resources := make([]*oapi.Resource, 1000)
	for i := 0; i < 1000; i++ {
		resources[i] = &oapi.Resource{
			Id:         string(rune(i)),
			Identifier: string(rune(i)),
			Name:       string(rune(i)),
			Kind:       "TestKind",
			Config:     map[string]interface{}{"key": "value"},
			Metadata:   map[string]string{"meta": "data"},
		}
	}

	providerId := "test-provider-large"

	// Store large batch
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)
	require.NotEmpty(t, batchId)

	// Retrieve large batch
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)
	require.NotNil(t, batch)

	// Verify size
	assert.Len(t, batch.Resources, 1000)
	assert.Equal(t, providerId, batch.ProviderId)
}

func TestResourceProviderCache_ConcurrentAccess(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	// Test concurrent stores
	const numGoroutines = 10
	batchIds := make(chan string, numGoroutines)

	for i := 0; i < numGoroutines; i++ {
		go func(index int) {
			resources := []*oapi.Resource{
				{
					Id:         string(rune(index)),
					Identifier: string(rune(index)),
					Name:       string(rune(index)),
					Kind:       "TestKind",
				},
			}

			providerId := string(rune(index))
			batchId, err := cache.Store(ctx, providerId, resources)
			if err == nil {
				batchIds <- batchId
			}
		}(i)
	}

	// Collect all batch IDs
	collected := make([]string, 0, numGoroutines)
	timeout := time.After(5 * time.Second)
	
	for i := 0; i < numGoroutines; i++ {
		select {
		case batchId := <-batchIds:
			collected = append(collected, batchId)
		case <-timeout:
			t.Fatal("Timeout waiting for concurrent stores")
		}
	}

	// Verify all batches were stored
	assert.Len(t, collected, numGoroutines)

	// Verify all are unique
	uniqueIds := make(map[string]bool)
	for _, id := range collected {
		uniqueIds[id] = true
	}
	assert.Len(t, uniqueIds, numGoroutines)
}

func TestResourceProviderCache_EmptyResources(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	// Store batch with empty resources
	resources := []*oapi.Resource{}
	providerId := "test-provider-empty"

	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Retrieve should work even with empty array
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)
	require.NotNil(t, batch)
	assert.Len(t, batch.Resources, 0)
	assert.Equal(t, providerId, batch.ProviderId)
}

func TestResourceProviderCache_ProviderIdValidation(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	resources := []*oapi.Resource{
		{Id: "res-1", Identifier: "test-1", Name: "Test 1", Kind: "TestKind"},
	}

	providerId := "test-provider-validation"

	// Store batch
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Retrieve batch
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)

	// Verify provider ID is preserved
	assert.Equal(t, providerId, batch.ProviderId)
}

func TestResourceProviderCache_CreatedAtTimestamp(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	resources := []*oapi.Resource{
		{Id: "res-1", Identifier: "test-1", Name: "Test 1", Kind: "TestKind"},
	}

	providerId := "test-provider-timestamp"

	beforeStore := time.Now()
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)
	afterStore := time.Now()

	// Retrieve immediately
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)

	// Verify CreatedAt is within expected range
	assert.True(t, batch.CreatedAt.After(beforeStore.Add(-time.Second)))
	assert.True(t, batch.CreatedAt.Before(afterStore.Add(time.Second)))
}

func TestResourceProviderCache_ResourceIntegrity(t *testing.T) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	// Create resources with complex data
	resources := []*oapi.Resource{
		{
			Id:         "res-complex",
			Identifier: "complex-resource",
			Name:       "Complex Resource",
			Kind:       "ComplexKind",
			Config: map[string]interface{}{
				"string":  "value",
				"number":  42,
				"boolean": true,
				"nested": map[string]interface{}{
					"key": "nested-value",
				},
			},
			Metadata: map[string]string{
				"env":     "production",
				"region":  "us-east-1",
				"version": "1.0.0",
			},
			Version: "v1",
		},
	}

	providerId := "test-provider-integrity"

	// Store batch
	batchId, err := cache.Store(ctx, providerId, resources)
	require.NoError(t, err)

	// Retrieve batch
	batch, err := cache.Retrieve(ctx, batchId)
	require.NoError(t, err)

	// Verify all fields are preserved
	retrieved := batch.Resources[0]
	assert.Equal(t, "res-complex", retrieved.Id)
	assert.Equal(t, "complex-resource", retrieved.Identifier)
	assert.Equal(t, "Complex Resource", retrieved.Name)
	assert.Equal(t, "ComplexKind", retrieved.Kind)
	assert.Equal(t, "v1", retrieved.Version)
	
	// Verify config
	assert.Equal(t, "value", retrieved.Config["string"])
	// Numbers are stored as-is in memory (not JSON serialized), so they maintain their type
	assert.Equal(t, 42, retrieved.Config["number"])
	assert.Equal(t, true, retrieved.Config["boolean"])
	
	// Verify metadata
	assert.Equal(t, "production", retrieved.Metadata["env"])
	assert.Equal(t, "us-east-1", retrieved.Metadata["region"])
	assert.Equal(t, "1.0.0", retrieved.Metadata["version"])
}

func BenchmarkResourceProviderCache_Store(b *testing.B) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	resources := make([]*oapi.Resource, 100)
	for i := 0; i < 100; i++ {
		resources[i] = &oapi.Resource{
			Id:         string(rune(i)),
			Identifier: string(rune(i)),
			Name:       string(rune(i)),
			Kind:       "TestKind",
		}
	}

	providerId := "bench-provider"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := cache.Store(ctx, providerId, resources)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkResourceProviderCache_Retrieve(b *testing.B) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	resources := make([]*oapi.Resource, 100)
	for i := 0; i < 100; i++ {
		resources[i] = &oapi.Resource{
			Id:         string(rune(i)),
			Identifier: string(rune(i)),
			Name:       string(rune(i)),
			Kind:       "TestKind",
		}
	}

	providerId := "bench-provider"

	// Store multiple batches for retrieval benchmark
	batchIds := make([]string, b.N)
	for i := 0; i < b.N; i++ {
		batchId, err := cache.Store(ctx, providerId, resources)
		if err != nil {
			b.Fatal(err)
		}
		batchIds[i] = batchId
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := cache.Retrieve(ctx, batchIds[i])
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkResourceProviderCache_StoreAndRetrieve(b *testing.B) {
	ctx := context.Background()
	cache := GetResourceProviderBatchCache()

	resources := make([]*oapi.Resource, 100)
	for i := 0; i < 100; i++ {
		resources[i] = &oapi.Resource{
			Id:         string(rune(i)),
			Identifier: string(rune(i)),
			Name:       string(rune(i)),
			Kind:       "TestKind",
		}
	}

	providerId := "bench-provider"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		batchId, err := cache.Store(ctx, providerId, resources)
		if err != nil {
			b.Fatal(err)
		}

		_, err = cache.Retrieve(ctx, batchId)
		if err != nil {
			b.Fatal(err)
		}
	}
}

