package repository

import (
	"context"
	"fmt"
	"workspace-engine/pkg/memsql"
	"workspace-engine/pkg/persistence"
)

var _ persistence.Repository[any] = &MemSQLAdapter[any]{}

type MemSQLAdapter[T any] struct {
	store *memsql.MemSQL[T]
}

func (a *MemSQLAdapter[T]) typeAndKey(entity any) (typed T, key string, err error) {
	typed, ok := entity.(T)
	if !ok {
		return typed, "", fmt.Errorf("expected %T, got %T", *new(T), entity)
	}

	keyer, ok := any(typed).(persistence.Entity)
	if !ok {
		return typed, "", fmt.Errorf("entity does not implement persistence.Entity interface")
	}
	_, key = keyer.CompactionKey()
	return typed, key, nil
}

func (a *MemSQLAdapter[T]) Set(ctx context.Context, entity any) error {
	typed, _, err := a.typeAndKey(entity)
	if err != nil {
		return err
	}
	return a.store.Insert(typed)
}

func (a *MemSQLAdapter[T]) Unset(ctx context.Context, entity any) error {
	_, key, err := a.typeAndKey(entity)
	if err != nil {
		return err
	}
	_, err = a.store.Delete("id = ?", key)
	if err != nil {
		return err
	}
	return err
}
