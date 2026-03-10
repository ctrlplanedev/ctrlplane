package store

import (
	"context"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

var resourceProvidersTracer = otel.Tracer("workspace/store/resource_providers")

type ResourceProviders struct {
	repo      repository.ResourceProviderRepo
	resources *Resources
	store     *Store
}

func NewResourceProviders(store *Store) *ResourceProviders {
	return &ResourceProviders{
		repo:      store.repo.ResourceProviders(),
		resources: store.Resources,
		store:     store,
	}
}

// SetRepo replaces the underlying ResourceProviderRepo implementation.
func (r *ResourceProviders) SetRepo(repo repository.ResourceProviderRepo) {
	r.repo = repo
}

func (r *ResourceProviders) Get(id string) (*oapi.ResourceProvider, bool) {
	return r.repo.Get(id)
}

func (r *ResourceProviders) Items() map[string]*oapi.ResourceProvider {
	return r.repo.Items()
}

func (r *ResourceProviders) Upsert(
	ctx context.Context,
	id string,
	resourceProvider *oapi.ResourceProvider,
) {
	_, span := resourceProvidersTracer.Start(ctx, "UpsertResourceProvider")
	defer span.End()

	if err := r.repo.Set(resourceProvider); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to upsert resource provider")
		log.Error("Failed to upsert resource provider", "error", err)
	}
	r.store.changeset.RecordUpsert(resourceProvider)
}

func (r *ResourceProviders) Remove(ctx context.Context, id string) error {
	resourceProvider, ok := r.repo.Get(id)
	if !ok {
		return nil
	}

	if err := r.repo.Remove(id); err != nil {
		return err
	}

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
