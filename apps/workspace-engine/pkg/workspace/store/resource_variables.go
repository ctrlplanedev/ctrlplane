package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewResourceVariables(store *Store) *ResourceVariables {
	return &ResourceVariables{
		repo:  store.repo,
		store: store,
	}
}

type ResourceVariables struct {
	repo  *repository.InMemoryStore
	store *Store
}

func (r *ResourceVariables) Upsert(ctx context.Context, resourceVariable *oapi.ResourceVariable) {
	r.repo.ResourceVariables.Set(resourceVariable.ID(), resourceVariable)
	r.store.changeset.RecordUpsert(resourceVariable)
}

func (r *ResourceVariables) Get(resourceId string, key string) (*oapi.ResourceVariable, bool) {
	return r.repo.ResourceVariables.Get(resourceId + "-" + key)
}

func (r *ResourceVariables) Remove(ctx context.Context, resourceId string, key string) {
	resourceVariable, ok := r.repo.ResourceVariables.Get(resourceId + "-" + key)
	if !ok || resourceVariable == nil {
		return
	}

	r.repo.ResourceVariables.Remove(resourceId + "-" + key)
	r.store.changeset.RecordDelete(resourceVariable)
}

func (r *ResourceVariables) Items() map[string]*oapi.ResourceVariable {
	return r.repo.ResourceVariables.Items()
}
