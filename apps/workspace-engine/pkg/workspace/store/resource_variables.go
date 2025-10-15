package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewResourceVariables(store *Store) *ResourceVariables {
	return &ResourceVariables{
		repo: store.repo,
	}
}

type ResourceVariables struct {
	repo *repository.Repository
}

func (r *ResourceVariables) IterBuffered() <-chan cmap.Tuple[string, *oapi.ResourceVariable] {
	return r.repo.ResourceVariables.IterBuffered()
}

func (r *ResourceVariables) Upsert(ctx context.Context, resourceVariable *oapi.ResourceVariable) {
	r.repo.ResourceVariables.Set(resourceVariable.ID(), resourceVariable)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeCreate, resourceVariable)
	}
}

func (r *ResourceVariables) Get(resourceId string, key string) (*oapi.ResourceVariable, bool) {
	return r.repo.ResourceVariables.Get(resourceId + "-" + key)
}

func (r *ResourceVariables) Remove(ctx context.Context, resourceId string, key string) {
	resourceVariable, ok := r.repo.ResourceVariables.Get(resourceId + "-" + key)
	if !ok { return }

	r.repo.ResourceVariables.Remove(resourceId + "-" + key)
	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, resourceVariable)
	}
}
