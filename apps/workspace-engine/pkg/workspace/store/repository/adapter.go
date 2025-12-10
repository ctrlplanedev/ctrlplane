package repository

import (
	"context"
	"fmt"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/persistence"
)

var _ persistence.Repository[any] = &TypedStoreAdapter[any]{}

// TypedStoreAdapter adapts a typed ConcurrentMap to the generic Repository[any] interface.
// This allows persistence systems to update the store without knowing the concrete type.
type TypedStoreAdapter[E any] struct {
	store *cmap.ConcurrentMap[string, E]
}

// typeAndKey performs type assertion and extracts the entity ID
func (a *TypedStoreAdapter[E]) typeAndKey(entity any) (typed E, key string, err error) {
	typed, ok := entity.(E)
	if !ok {
		return typed, "", fmt.Errorf("expected %T, got %T", *new(E), entity)
	}

	keyer, ok := any(typed).(persistence.Entity)
	if !ok {
		return typed, "", fmt.Errorf("entity does not implement persistence.Entity interface")
	}
	_, key = keyer.CompactionKey()
	return typed, key, nil
}

func (a *TypedStoreAdapter[E]) Set(ctx context.Context, entity any) error {
	typed, key, err := a.typeAndKey(entity)
	if err != nil {
		return err
	}
	a.store.Set(key, typed)
	return nil
}

func (a *TypedStoreAdapter[E]) Unset(ctx context.Context, entity any) error {
	_, key, err := a.typeAndKey(entity)
	if err != nil {
		return err
	}
	a.store.Remove(key)
	return nil
}
