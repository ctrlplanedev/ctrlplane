package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

type ResourceProviders struct {
	repo      *repository.Repo
	resources *Resources
	store     *Store
}

func NewResourceProviders(store *Store) *ResourceProviders {
	return &ResourceProviders{
		repo:      store.repo,
		resources: store.Resources,
		store:     store,
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
	r.store.changeset.RecordUpsert(resourceProvider)
}

func (r *ResourceProviders) Remove(ctx context.Context, id string) error {
	resourceProvider, ok := r.repo.ResourceProviders.Get(id)
	if !ok {
		return nil
	}

	// Remove the resource provider from the repository.
	r.repo.ResourceProviders.Remove(id)

	// Iterate over all resources and unset their ProviderId if they were using the deleted provider.
	// This ensures that resources no longer reference a provider that has been deleted.
	for _, resource := range r.resources.Items() {
		if resource.ProviderId != nil && *resource.ProviderId == id {
			resource.ProviderId = nil
			if _, err := r.resources.Upsert(ctx, resource); err != nil {
				return err
			}
		}
	}

	r.store.changeset.RecordDelete(resourceProvider)
	return nil
}
