package secrets

import (
	"sync"
	"time"

	"github.com/google/uuid"
)

// cacheKey identifies a single resolved secret value. Path is normalized to
// "" when absent so that "<ws>:<provider>::<key>" and "<ws>:<provider>:/:<key>"
// don't collide.
type cacheKey struct {
	WorkspaceID uuid.UUID
	Provider    string
	Path        string
	Key         string
	Version     string
}

type cacheEntry struct {
	value     string
	expiresAt time.Time
}

// Cache is a goroutine-safe TTL cache for resolved secret values. Entries
// expire passively on read; explicit invalidation is provided for provider
// updates received over LISTEN/NOTIFY.
type Cache struct {
	ttl     time.Duration
	now     func() time.Time
	mu      sync.RWMutex
	entries map[cacheKey]cacheEntry
}

// NewCache constructs an empty cache. ttl of zero disables caching (every Get
// returns a miss).
func NewCache(ttl time.Duration) *Cache {
	return &Cache{
		ttl:     ttl,
		now:     time.Now,
		entries: make(map[cacheKey]cacheEntry),
	}
}

func keyFor(workspaceID uuid.UUID, ref SecretReference) cacheKey {
	return cacheKey{
		WorkspaceID: workspaceID,
		Provider:    ref.Provider,
		Path:        ref.Path,
		Key:         ref.Key,
		Version:     ref.Version,
	}
}

// Get returns the cached value if present and unexpired. The boolean return
// distinguishes a cache hit from a miss.
func (c *Cache) Get(workspaceID uuid.UUID, ref SecretReference) (string, bool) {
	if c.ttl <= 0 {
		return "", false
	}
	c.mu.RLock()
	entry, ok := c.entries[keyFor(workspaceID, ref)]
	c.mu.RUnlock()
	if !ok {
		return "", false
	}
	if c.now().After(entry.expiresAt) {
		return "", false
	}
	return entry.value, true
}

// Set stores a resolved value. The TTL is taken from the cache; per-entry
// TTLs are not supported.
func (c *Cache) Set(workspaceID uuid.UUID, ref SecretReference, value string) {
	if c.ttl <= 0 {
		return
	}
	c.mu.Lock()
	c.entries[keyFor(workspaceID, ref)] = cacheEntry{
		value:     value,
		expiresAt: c.now().Add(c.ttl),
	}
	c.mu.Unlock()
}

// InvalidateProvider drops every entry that resolves through the named
// provider in the given workspace. Called by the LISTEN/NOTIFY consumer when
// the TS api updates a secret_provider row.
func (c *Cache) InvalidateProvider(workspaceID uuid.UUID, providerName string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k := range c.entries {
		if k.WorkspaceID == workspaceID && k.Provider == providerName {
			delete(c.entries, k)
		}
	}
}

// InvalidateAll empties the cache. Intended for tests and admin operations.
func (c *Cache) InvalidateAll() {
	c.mu.Lock()
	c.entries = make(map[cacheKey]cacheEntry)
	c.mu.Unlock()
}

// Size returns the number of entries currently cached. Expired entries that
// have not yet been observed by Get are counted.
func (c *Cache) Size() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.entries)
}
