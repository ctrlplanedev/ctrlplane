package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

type ResourceProviders struct {
	repo      *repository.Repository
	resources *Resources
}

func NewResourceProviders(store *Store) *ResourceProviders {
	return &ResourceProviders{
		repo:      store.repo,
		resources: store.Resources,
	}
}

func (r *ResourceProviders) Get(id string) (*oapi.ResourceProvider, bool) {
	return r.repo.ResourceProviders.Get(id)
}

func (r *ResourceProviders) Items() map[string]*oapi.ResourceProvider {
	return r.repo.ResourceProviders.Items()
}

func (r *ResourceProviders) Upsert(ctx context.Context, id string, resourceProvider *oapi.ResourceProvider) {
	r.repo.ResourceProviders.Set(id, resourceProvider)
	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("resource-provider", changeset.ChangeTypeInsert, id, resourceProvider)
	}
}

func (r *ResourceProviders) Remove(ctx context.Context, id string) error {
	r.repo.ResourceProviders.Remove(id)
	for _, resource := range r.resources.Items() {
		if resource.ProviderId != nil && *resource.ProviderId == id {
			resource.ProviderId = nil
			if _, err := r.resources.Upsert(ctx, resource); err != nil {
				return err
			}
		}
	}
	if cs, ok := changeset.FromContext(ctx); ok {
		cs.Record("resource-provider", changeset.ChangeTypeDelete, id, nil)
	}
	return nil
}
