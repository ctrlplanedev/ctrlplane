package model

import (
	"context"
)

type Repository[T Entity] interface {
	GetAll(ctx context.Context) []*T
	Get(ctx context.Context, entityID string) *T
	Create(ctx context.Context, entity *T) error
	Update(ctx context.Context, entity *T) error
	Delete(ctx context.Context, entityID string) error
	Exists(ctx context.Context, entityID string) bool
}

var _ Repository[Entity] = (*RepositoryWithID[Entity])(nil)

type RepositoryWithID[T Entity] struct {
	entities map[string]*T
}

func (r *RepositoryWithID[T]) GetAll(ctx context.Context) []*T {
	entities := make([]*T, 0, len(r.entities))
	for _, entity := range r.entities {
		entities = append(entities, entity)
	}
	return entities
}

func (r *RepositoryWithID[T]) Get(ctx context.Context, entityID string) *T {
	return r.entities[entityID]
}

func (r *RepositoryWithID[T]) Create(ctx context.Context, entity *T) error {
	r.entities[(*entity).GetID()] = entity
	return nil
}

func (r *RepositoryWithID[T]) Update(ctx context.Context, entity *T) error {
	r.entities[(*entity).GetID()] = entity
	return nil
}

func (r *RepositoryWithID[T]) Delete(ctx context.Context, entityID string) error {
	delete(r.entities, entityID)
	return nil
}

func (r *RepositoryWithID[T]) Exists(ctx context.Context, entityID string) bool {
	_, exists := r.entities[entityID]
	return exists
}
