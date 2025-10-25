package persistence

import (
	"context"
	"fmt"
)

// ApplyRegistry manages repositories for different entity types
type ApplyRegistry struct {
	repositories map[string]Repository[any]
}

func NewApplyRegistry() *ApplyRegistry {
	return &ApplyRegistry{
		repositories: make(map[string]Repository[any]),
	}
}

func (r *ApplyRegistry) Register(entityType string, repo Repository[any]) {
	r.repositories[entityType] = repo
}

// Apply applies a snapshot to the registered repositories.
// Deduplicates changes per entity, keeping only the latest change (by timestamp).
// This handles cases where the underlying store (e.g., Kafka) hasn't compacted yet.
func (r *ApplyRegistry) Apply(ctx context.Context, changes Changes) error {
	// Deduplicate: keep only the latest change per entity
	latestChanges := make(map[string]Change)
	for _, change := range changes {
		entityType, entityID := change.Entity.CompactionKey()
		key := entityType + ":" + entityID

		// Keep the change with the latest timestamp
		if existing, exists := latestChanges[key]; !exists || change.Timestamp.After(existing.Timestamp) {
			latestChanges[key] = change
		}
	}

	// Apply the deduplicated changes
	for _, change := range latestChanges {
		entityType, _ := change.Entity.CompactionKey()
		repo, exists := r.repositories[entityType]
		if !exists {
			return fmt.Errorf("no repository registered for entity type: %s", entityType)
		}

		var err error
		switch change.ChangeType {
		case ChangeTypeSet:
			err = repo.Set(ctx, change.Entity)
		case ChangeTypeUnset:
			err = repo.Unset(ctx, change.Entity)
		default:
			err = fmt.Errorf("unknown change type: %s", change.ChangeType)
		}

		if err != nil {
			return fmt.Errorf("failed to apply change (type=%s): %w", change.ChangeType, err)
		}
	}

	return nil
}
