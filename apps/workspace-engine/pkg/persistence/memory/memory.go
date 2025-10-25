package memory

import (
	"context"
	"sync"
	"time"

	"workspace-engine/pkg/persistence"
)

// Store is an in-memory implementation of persistence.Store
// Thread-safe and suitable for testing or development.
// This implementation performs topic compaction: only the latest state per entity is stored.
type Store struct {
	mu      sync.RWMutex
	// Maps namespace -> (entityType:entityID) -> latest change
	snapshots map[string]map[string]persistence.Change
}

// NewStore creates a new in-memory snapshot store
func NewStore() *Store {
	return &Store{
		snapshots: make(map[string]map[string]persistence.Change),
	}
}

// Save adds changes to the in-memory store, compacting per entity
func (s *Store) Save(ctx context.Context, changes persistence.Changes) error {
	if len(changes) == 0 {
		return nil
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	// Set timestamps if not provided
	for i := range changes {
		if changes[i].Timestamp.IsZero() {
			changes[i].Timestamp = time.Now()
		}
	}

	for _, change := range changes {
		// Ensure namespace map exists
		if s.snapshots[change.Namespace] == nil {
			s.snapshots[change.Namespace] = make(map[string]persistence.Change)
		}

		// Get entity key for compaction
		entityType, entityID := change.Entity.CompactionKey()
		key := entityType + ":" + entityID

		// Compact: store only latest change per entity
		// If ChangeType is Delete, we still store it (to track deletion state)
		s.snapshots[change.Namespace][key] = change
	}
	return nil
}

// Load retrieves the compacted snapshot for a namespace
// Returns only the latest change per entity
func (s *Store) Load(ctx context.Context, namespace string) (persistence.Changes, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	entityMap := s.snapshots[namespace]
	if entityMap == nil {
		return persistence.Changes{}, nil
	}

	// Convert map to slice
	result := make(persistence.Changes, 0, len(entityMap))
	for _, change := range entityMap {
		result = append(result, change)
	}

	return result, nil
}

// Close closes the store (no-op for in-memory implementation)
func (s *Store) Close() error {
	return nil
}

// Clear removes all snapshots (useful for testing)
func (s *Store) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.snapshots = make(map[string]map[string]persistence.Change)
}

// NamespaceCount returns the number of namespaces in the store
func (s *Store) NamespaceCount() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.snapshots)
}

// EntityCount returns the total number of entities (compacted) for a namespace
func (s *Store) EntityCount(namespace string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.snapshots[namespace] == nil {
		return 0
	}
	return len(s.snapshots[namespace])
}
