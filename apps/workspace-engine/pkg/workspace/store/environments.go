package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewEnvironments(store *Store) *Environments {
	return &Environments{
		repo:      store.repo,
		store:     store,
	}
}

type Environments struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (e *Environments) Items() map[string]*oapi.Environment {
	return e.repo.Environments
}

func (e *Environments) Get(id string) (*oapi.Environment, bool) {
	return e.repo.Environments.Get(id)
}

func (e *Environments) Upsert(ctx context.Context, environment *oapi.Environment) error {
	e.repo.Environments.Set(environment.Id, environment)
	e.store.changeset.RecordUpsert(environment)

	return nil
}

func (e *Environments) Remove(ctx context.Context, id string) {
	env, ok := e.Get(id)
	if !ok || env == nil {
		return
	}

	e.repo.Environments.Remove(id)
	e.store.changeset.RecordDelete(env)
}
