package pebble

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"workspace-engine/pkg/persistence"

	"github.com/cockroachdb/pebble"
)

// Store is a Pebble-based implementation of persistence.Store
// Uses an embedded key-value store for efficient persistence with automatic compaction.
type Store struct {	
	db       *pebble.DB
	registry *persistence.JSONEntityRegistry
	mu       sync.RWMutex
}

// storedChange is the on-disk representation of a persistence.Change
type storedChange struct {
	Namespace  string          `json:"namespace"`
	ChangeType string          `json:"changeType"`
	EntityType string          `json:"entityType"`
	EntityID   string          `json:"entityID"`
	Entity     json.RawMessage `json:"entity"`
	Timestamp  time.Time       `json:"timestamp"`
}

// NewStore creates a new Pebble-based persistence store
func NewStore(dbPath string, registry *persistence.JSONEntityRegistry) (*Store, error) {
	db, err := pebble.Open(dbPath, &pebble.Options{
		// Enable automatic compaction
		DisableAutomaticCompactions: false,
		// Set reasonable cache size (128MB)
		Cache: pebble.NewCache(128 << 20),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to open pebble database: %w", err)
	}
	
	return &Store{
		db:       db,
		registry: registry,
	}, nil
}

// Save persists changes to the Pebble database
// Each entity is stored with a key: namespace:entityType:entityID
// This naturally supports compaction - newer values overwrite older ones
func (s *Store) Save(ctx context.Context, changes persistence.Changes) error {
	if len(changes) == 0 {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	batch := s.db.NewBatch()
	defer batch.Close()

	for _, change := range changes {
		// Set timestamp if not provided
		timestamp := change.Timestamp
		if timestamp.IsZero() {
			timestamp = time.Now()
		}

		entityType, entityID := change.Entity.CompactionKey()

		// Serialize entity
		entityJSON, err := json.Marshal(change.Entity)
		if err != nil {
			return fmt.Errorf("failed to marshal entity: %w", err)
		}

		// Create stored change
		stored := storedChange{
			Namespace:  change.Namespace,
			ChangeType: string(change.ChangeType),
			EntityType: entityType,
			EntityID:   entityID,
			Entity:     entityJSON,
			Timestamp:  timestamp,
		}

		// Serialize the change
		changeJSON, err := json.Marshal(stored)
		if err != nil {
			return fmt.Errorf("failed to marshal change: %w", err)
		}

		// Create key: namespace:entityType:entityID
		key := makeKey(change.Namespace, entityType, entityID)

		// Store in batch
		if err := batch.Set([]byte(key), changeJSON, pebble.Sync); err != nil {
			return fmt.Errorf("failed to set value in batch: %w", err)
		}
	}

	// Commit the batch
	if err := batch.Commit(pebble.Sync); err != nil {
		return fmt.Errorf("failed to commit batch: %w", err)
	}

	return nil
}

// Load retrieves the current state for a namespace
// Scans all keys with the namespace prefix and returns the changes
func (s *Store) Load(ctx context.Context, namespace string) (persistence.Changes, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Create prefix for namespace
	prefix := []byte(namespace + ":")
	
	// Use prefix iterator
	iter, err := s.db.NewIter(&pebble.IterOptions{
		LowerBound: prefix,
		UpperBound: prefixUpperBound(prefix),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create iterator: %w", err)
	}
	defer iter.Close()

	var result persistence.Changes
	
	// Iterate through all keys with the namespace prefix
	for iter.First(); iter.Valid(); iter.Next() {
		// Deserialize the stored change
		var stored storedChange
		if err := json.Unmarshal(iter.Value(), &stored); err != nil {
			return nil, fmt.Errorf("failed to unmarshal stored change: %w", err)
		}

		// Unmarshal the entity using the registry
		entity, err := s.registry.Unmarshal(stored.EntityType, stored.Entity)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal entity type %s: %w", stored.EntityType, err)
		}

		// Add to result
		result = append(result, persistence.Change{
			Namespace:  stored.Namespace,
			ChangeType: persistence.ChangeType(stored.ChangeType),
			Entity:     entity,
			Timestamp:  stored.Timestamp,
		})
	}

	if err := iter.Error(); err != nil {
		return nil, fmt.Errorf("iterator error: %w", err)
	}

	return result, nil
}

// Close closes the Pebble database
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db != nil {
		if err := s.db.Close(); err != nil {
			return fmt.Errorf("failed to close pebble database: %w", err)
		}
	}
	return nil
}

// ListNamespaces returns all unique namespaces in the store
func (s *Store) ListNamespaces() ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	iter, err := s.db.NewIter(nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create iterator: %w", err)
	}
	defer iter.Close()

	namespaces := make(map[string]struct{})
	
	for iter.First(); iter.Valid(); iter.Next() {
		key := string(iter.Key())
		// Extract namespace (first part before ':')
		parts := strings.SplitN(key, ":", 2)
		if len(parts) > 0 {
			namespaces[parts[0]] = struct{}{}
		}
	}

	if err := iter.Error(); err != nil {
		return nil, fmt.Errorf("iterator error: %w", err)
	}

	// Convert map to slice
	result := make([]string, 0, len(namespaces))
	for ns := range namespaces {
		result = append(result, ns)
	}

	// Sort for deterministic output
	sort.Strings(result)

	return result, nil
}

// DeleteNamespace removes all data for a namespace
func (s *Store) DeleteNamespace(namespace string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	prefix := []byte(namespace + ":")
	
	// Delete all keys with this prefix
	return s.db.DeleteRange(prefix, prefixUpperBound(prefix), pebble.Sync)
}

// makeKey creates a composite key for storage
func makeKey(namespace, entityType, entityID string) string {
	return fmt.Sprintf("%s:%s:%s", namespace, entityType, entityID)
}

// prefixUpperBound returns the upper bound for a prefix scan
func prefixUpperBound(prefix []byte) []byte {
	end := make([]byte, len(prefix))
	copy(end, prefix)
	for i := len(end) - 1; i >= 0; i-- {
		end[i]++
		if end[i] != 0 {
			return end
		}
	}
	return nil // prefix is all 0xFF
}
