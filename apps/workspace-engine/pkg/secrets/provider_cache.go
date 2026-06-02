package secrets

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// providerCacheKey identifies a constructed Provider instance scoped to a
// workspace + secret_provider row name.
type providerCacheKey struct {
	WorkspaceID uuid.UUID
	Name        string
}

type providerCacheEntry struct {
	provider  Provider
	expiresAt time.Time
}

// ProviderCache memoizes constructed Provider instances per
// (workspaceID, providerName) so that hot release fan-outs do not pay for
// repeated config decryption + factory construction (AWS LoadDefaultConfig,
// HTTP client rebuilds, etc.).
type ProviderCache struct {
	ttl     time.Duration
	now     func() time.Time
	mu      sync.RWMutex
	entries map[providerCacheKey]providerCacheEntry
}

// NewProviderCache constructs a cache. A non-positive TTL disables caching.
func NewProviderCache(ttl time.Duration) *ProviderCache {
	return &ProviderCache{
		ttl:     ttl,
		now:     time.Now,
		entries: make(map[providerCacheKey]providerCacheEntry),
	}
}

func providerKeyFor(workspaceID uuid.UUID, providerName string) providerCacheKey {
	return providerCacheKey{WorkspaceID: workspaceID, Name: providerName}
}

// Get returns the cached Provider if present and unexpired.
func (c *ProviderCache) Get(workspaceID uuid.UUID, providerName string) (Provider, bool) {
	if c.ttl <= 0 {
		return nil, false
	}
	c.mu.RLock()
	entry, ok := c.entries[providerKeyFor(workspaceID, providerName)]
	c.mu.RUnlock()
	if !ok {
		return nil, false
	}
	if c.now().After(entry.expiresAt) {
		return nil, false
	}
	return entry.provider, true
}

// Set stores the constructed Provider with the cache TTL applied.
func (c *ProviderCache) Set(workspaceID uuid.UUID, providerName string, p Provider) {
	if c.ttl <= 0 {
		return
	}
	c.mu.Lock()
	c.entries[providerKeyFor(workspaceID, providerName)] = providerCacheEntry{
		provider:  p,
		expiresAt: c.now().Add(c.ttl),
	}
	c.mu.Unlock()
}

// Invalidate drops the Provider for the named provider in the given
// workspace. Wired into LISTEN/NOTIFY so an upstream config change forces
// reconstruction on the next resolve.
func (c *ProviderCache) Invalidate(workspaceID uuid.UUID, providerName string) {
	c.mu.Lock()
	delete(c.entries, providerKeyFor(workspaceID, providerName))
	c.mu.Unlock()
}

// InvalidateAll drops every cached Provider.
func (c *ProviderCache) InvalidateAll() {
	c.mu.Lock()
	c.entries = make(map[providerCacheKey]providerCacheEntry)
	c.mu.Unlock()
}

// Size returns the number of entries currently cached.
func (c *ProviderCache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}
