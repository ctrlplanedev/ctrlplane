package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

type ResourceProviders struct {
	repo *repository.Repository
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

func (r *ResourceProviders) Set(id string, resourceProvider *oapi.ResourceProvider) {
	r.repo.ResourceProviders.Set(id, resourceProvider)
}

func (r *ResourceProviders) Remove(ctx context.Context, id string) {
	r.repo.ResourceProviders.Remove(id)
	for _, resource := range r.resources.Items() {
		if resource.ProviderId != nil && *resource.ProviderId == id {
			resource.ProviderId = nil
			r.resources.Upsert(ctx, resource)
		}
	}
}