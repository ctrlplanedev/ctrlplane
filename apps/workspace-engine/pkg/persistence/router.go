package persistence

import (
	"context"
	"fmt"
)

// RepositoryRouter routes entity changes to the appropriate repository based on entity type.
// It acts as a dispatcher that maps entity types to their corresponding repositories.
type RepositoryRouter struct {
	repositories map[string]Repository[any]
}

func NewRepositoryRouter() *RepositoryRouter {
	return &RepositoryRouter{
		repositories: make(map[string]Repository[any]),
	}
}

func (r *RepositoryRouter) Register(entityType string, repo Repository[any]) {
	r.repositories[entityType] = repo
}

// Apply applies changes to the registered repositories by routing each change
// to its corresponding repository based on entity type.
// Deduplicates changes per entity, keeping only the latest change (by timestamp).
// This handles cases where the underlying store (e.g., Kafka) hasn't compacted yet.
func (r *RepositoryRouter) Apply(ctx context.Context, changes Changes) error {
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
			continue
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
