package store

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/diffcheck"
	"workspace-engine/pkg/workspace/store/repository"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func NewResources(store *Store) *Resources {
	return &Resources{
		repo:  store.repo.Resources(),
		store: store,
	}
}

type Resources struct {
	repo  repository.ResourceRepo
	store *Store
}

// SetRepo replaces the underlying ResourceRepo implementation.
func (r *Resources) SetRepo(repo repository.ResourceRepo) {
	r.repo = repo
}

func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) (*oapi.Resource, error) {
	_, span := tracer.Start(ctx, "Upsert", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
	))
	defer span.End()

	existing, exists := r.repo.Get(resource.Id)

	if exists && existing != nil {
		if resource.CreatedAt.IsZero() {
			resource.CreatedAt = existing.CreatedAt
		}
		if len(diffcheck.HasResourceChanges(existing, resource)) > 0 {
			now := time.Now()
			resource.UpdatedAt = &now
		}
	} else {
		if resource.CreatedAt.IsZero() {
			resource.CreatedAt = time.Now()
		}
	}

	if err := r.repo.Set(resource); err != nil {
		return nil, err
	}
	r.store.changeset.RecordUpsert(resource)

	return resource, nil
}

func (r *Resources) Get(id string) (*oapi.Resource, bool) {
	return r.repo.Get(id)
}

func (r *Resources) Remove(ctx context.Context, id string) {
	_, span := tracer.Start(ctx, "Remove", trace.WithAttributes(
		attribute.String("resource.id", id),
	))
	defer span.End()

	resource, ok := r.repo.Get(id)
	if !ok || resource == nil {
		return
	}

	entity := relationships.NewResourceEntity(resource)
	r.store.Relations.RemoveForEntity(ctx, entity)

	r.repo.Remove(id)
	r.store.changeset.RecordDelete(resource)
}

func (r *Resources) Items() map[string]*oapi.Resource {
	return r.repo.Items()
}

func (r *Resources) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	return r.repo.GetByIdentifier(identifier)
}

func (r *Resources) Variables(resourceId string) map[string]*oapi.ResourceVariable {
	variables := make(map[string]*oapi.ResourceVariable, 25)
	for _, variable := range r.store.repo.ResourceVariables.Items() {
		if variable.ResourceId != resourceId {
			continue
		}
		variables[variable.Key] = variable
	}
	return variables
}

func (r *Resources) ForSelector(ctx context.Context, sel *oapi.Selector) map[string]*oapi.Resource {
	resources := make(map[string]*oapi.Resource)
	for _, resource := range r.Items() {
		matched, err := selector.Match(ctx, sel, resource)
		if err != nil {
			continue
		}
		if matched {
			resources[resource.Id] = resource
		}
	}
	return resources
}

func (r *Resources) ForEnvironment(ctx context.Context, environment *oapi.Environment) map[string]*oapi.Resource {
	return r.ForSelector(ctx, environment.ResourceSelector)
}

func (r *Resources) ForDeployment(ctx context.Context, deployment *oapi.Deployment) map[string]*oapi.Resource {
	return r.ForSelector(ctx, deployment.ResourceSelector)
}

func (r *Resources) ForProvider(ctx context.Context, providerId string) map[string]*oapi.Resource {
	resources := make(map[string]*oapi.Resource)
	for _, resource := range r.Items() {
		if resource.ProviderId != nil && *resource.ProviderId == providerId {
			resources[resource.Id] = resource
		}
	}
	return resources
}
