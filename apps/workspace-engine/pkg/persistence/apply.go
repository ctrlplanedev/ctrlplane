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

// Apply applies a changelog to the registered repositories
func (r *ApplyRegistry) Apply(ctx context.Context, changelog Changelog) error {
	for _, change := range changelog {
		entityType, _ := change.Entity.ChangelogKey()
		repo, exists := r.repositories[entityType]
		if !exists {
			return fmt.Errorf("no repository registered for entity type: %s", entityType)
		}

		var err error
		switch change.ChangeType {
		case ChangeTypeCreate:
			err = repo.Create(ctx, change.Entity)
		case ChangeTypeUpdate:
			err = repo.Update(ctx, change.Entity)
		case ChangeTypeDelete:
			err = repo.Delete(ctx, change.Entity)
		default:
			err = fmt.Errorf("unknown change type: %s", change.ChangeType)
		}

		if err != nil {
			return fmt.Errorf("failed to apply change (type=%s): %w", change.ChangeType, err)
		}
	}

	return nil
}
