package store

import (
	"context"
	"fmt"
	"sync"
	"time"
	"workspace-engine/pkg/oapi"

	"github.com/charmbracelet/log"
	"github.com/dgraph-io/ristretto/v2"
	"github.com/google/uuid"
)

// CachedBatch represents a temporarily stored resource batch
type CachedBatch struct {
	BatchId    string
	ProviderId string
	Resources  []*oapi.Resource
	CreatedAt  time.Time
}

// ResourceProviderCache manages temporary storage of large resource batches
// Uses Ristretto for high-performance in-memory caching with automatic eviction
type ResourceProviderCache struct {
	cache *ristretto.Cache[string, *CachedBatch]
	once  sync.Once
}

var (
	globalCache     *ResourceProviderCache
	globalCacheOnce sync.Once
)

// initCache initializes the Ristretto cache (called once)
func (c *ResourceProviderCache) initCache() {
	c.once.Do(func() {
		// Configure Ristretto cache
		cache, err := ristretto.NewCache(&ristretto.Config[string, *CachedBatch]{
			// NumCounters: number of keys to track frequency (10x max items)
			NumCounters: 10000,

			// MaxCost: maximum memory cost (in bytes)
			// Assume average batch is ~10MB, allow 100 batches = 1GB
			MaxCost: 1 << 30, // 1GB

			// BufferItems: number of items per Get buffer
			BufferItems: 64,

			// Cost function: estimate memory usage of each batch
			Cost: func(value *CachedBatch) int64 {
				// Rough estimate: 2KB per resource
				return int64(len(value.Resources) * 2048)
			},

			// OnEvict: log when batches are evicted
			OnEvict: func(item *ristretto.Item[*CachedBatch]) {
				if item.Value != nil {
					log.Warn("Evicting cached batch (TTL expired or memory pressure)",
						"batchId", item.Value.BatchId,
						"providerId", item.Value.ProviderId,
						"resourceCount", len(item.Value.Resources),
						"age", time.Since(item.Value.CreatedAt))
				}
			},
		})

		if err != nil {
			log.Fatal("Failed to create Ristretto cache", "error", err)
		}

		c.cache = cache
		log.Info("Initialized resource provider batch cache")
	})
}

// GetResourceProviderBatchCache returns the global batch cache instance
func GetResourceProviderBatchCache() *ResourceProviderCache {
	globalCacheOnce.Do(func() {
		globalCache = &ResourceProviderCache{}
		globalCache.initCache()
	})
	return globalCache
}

// Store caches a batch of resources with a generated batch ID
// Returns the batch ID that can be used to retrieve the batch later
func (c *ResourceProviderCache) Store(ctx context.Context, providerId string, resources []*oapi.Resource) (string, error) {
	c.initCache()

	batchId := uuid.New().String()

	batch := &CachedBatch{
		BatchId:    batchId,
		ProviderId: providerId,
		Resources:  resources,
		CreatedAt:  time.Now(),
	}

	// Calculate cost (for Ristretto's memory management)
	cost := int64(len(resources) * 2048) // ~2KB per resource

	// Store with 5-minute TTL
	// The cache will automatically evict after TTL or if memory pressure occurs
	success := c.cache.SetWithTTL(batchId, batch, cost, 5*time.Minute)
	if !success {
		return "", fmt.Errorf("failed to store batch in cache (possible memory pressure)")
	}

	// Wait for value to be set (Ristretto is eventually consistent)
	c.cache.Wait()

	return batchId, nil
}

// Retrieve fetches and removes a cached batch
// This is a one-time operation - the batch is deleted after retrieval
func (c *ResourceProviderCache) Retrieve(ctx context.Context, batchId string) (*CachedBatch, error) {
	c.initCache()

	// Get from cache
	batch, found := c.cache.Get(batchId)
	if !found {
		return nil, fmt.Errorf("batch not found or expired: %s", batchId)
	}

	// Delete immediately (claim check pattern - one-time use)
	c.cache.Del(batchId)

	return batch, nil
}
