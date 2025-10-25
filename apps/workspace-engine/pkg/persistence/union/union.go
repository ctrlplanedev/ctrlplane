package union

import (
	"context"
	"fmt"

	"workspace-engine/pkg/persistence"
)

// Store is a union of multiple stores that saves to all and loads from all,
// merging results and keeping the latest change per entity.
type Store struct {
	stores []persistence.Store
}

// New creates a new union store that aggregates multiple stores.
func New(stores ...persistence.Store) *Store {
	return &Store{
		stores: stores,
	}
}

// Save persists changes to all underlying stores.
// If any store fails, returns the first error encountered.
func (s *Store) Save(ctx context.Context, changes persistence.Changes) error {
	for i, store := range s.stores {
		if err := store.Save(ctx, changes); err != nil {
			return fmt.Errorf("store[%d] save failed: %w", i, err)
		}
	}
	return nil
}

// Load retrieves changes from all underlying stores and merges them,
// keeping only the latest change per entity (by timestamp).
func (s *Store) Load(ctx context.Context, namespace string) (persistence.Changes, error) {
	// Load from all stores
	allChanges := make([]persistence.Changes, 0, len(s.stores))
	for i, store := range s.stores {
		changes, err := store.Load(ctx, namespace)
		if err != nil {
			return nil, fmt.Errorf("store[%d] load failed: %w", i, err)
		}
		allChanges = append(allChanges, changes)
	}

	// Merge all changes, keeping latest per entity
	merged := make(map[string]persistence.Change)
	for _, changes := range allChanges {
		for _, change := range changes {
			entityType, entityID := change.Entity.CompactionKey()
			key := entityType + ":" + entityID

			// Keep the change with the latest timestamp
			if existing, exists := merged[key]; !exists || change.Timestamp.After(existing.Timestamp) {
				merged[key] = change
			}
		}
	}

	// Convert map to slice
	result := make(persistence.Changes, 0, len(merged))
	for _, change := range merged {
		result = append(result, change)
	}

	return result, nil
}

// Close closes all underlying stores.
// Returns the first error encountered, but continues closing remaining stores.
func (s *Store) Close() error {
	var firstErr error
	for i, store := range s.stores {
		if err := store.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("store[%d] close failed: %w", i, err)
		}
	}
	return firstErr
}

// StoreCount returns the number of underlying stores.
func (s *Store) StoreCount() int {
	return len(s.stores)
}
