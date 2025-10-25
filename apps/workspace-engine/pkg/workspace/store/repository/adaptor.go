package repository

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/persistence"
)

// RepositoryAdapter bridges typed ConcurrentMap to Repository[any]
type RepositoryAdapter[E any] struct {
	cm *cmap.ConcurrentMap[string, E]
}

// typeAndKey performs type assertion and extracts the entity ID
func (r *RepositoryAdapter[E]) typeAndKey(entity any) (typed E, key string, err error) {
	typed, ok := entity.(E)
	if !ok {
		return typed, "", fmt.Errorf("expected %T, got %T", *new(E), entity)
	}
	
	keyer, ok := any(typed).(persistence.Entity)
	if !ok {
		return typed, "", fmt.Errorf("entity does not implement persistence.Entity interface")
	}
	_, key = keyer.ChangelogKey()
	return typed, key, nil
}

func (r *RepositoryAdapter[E]) Create(ctx context.Context, entity any) error {
	typed, key, err := r.typeAndKey(entity)
	if err != nil {
		return err
	}
	r.cm.Set(key, typed)
	return nil
}

func (r *RepositoryAdapter[E]) Update(ctx context.Context, entity any) error {
	typed, key, err := r.typeAndKey(entity)
	if err != nil {
		return err
	}
	r.cm.Set(key, typed)
	return nil
}

func (r *RepositoryAdapter[E]) Delete(ctx context.Context, entity any) error {
	_, key, err := r.typeAndKey(entity)
	if err != nil {
		return err
	}
	r.cm.Remove(key)
	return nil
}