package store

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store/diffcheck"
	"workspace-engine/pkg/workspace/store/repository/memory"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

func NewResources(store *Store) *Resources {
	return &Resources{
		repo:  store.repo,
		store: store,
	}
}

type Resources struct {
	repo  *memory.InMemory
	store *Store
}

func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) (*oapi.Resource, error) {
	_, span := tracer.Start(ctx, "Upsert", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
	))
	defer span.End()

	// Check if resource already exists to determine if this is an update
	existing, exists := r.repo.Resources.Get(resource.Id)

	if exists && existing != nil {
		// Preserve CreatedAt from the existing resource
		if resource.CreatedAt.IsZero() {
			resource.CreatedAt = existing.CreatedAt
		}
		// Only set UpdatedAt if there are actual changes
		if len(diffcheck.HasResourceChanges(existing, resource)) > 0 {
			now := time.Now()
			resource.UpdatedAt = &now
		}
	} else {
		// New resource - ensure CreatedAt is set
		if resource.CreatedAt.IsZero() {
			resource.CreatedAt = time.Now()
		}
	}

	// Store the resource
	r.repo.Resources.Set(resource.Id, resource)
	r.store.changeset.RecordUpsert(resource)

	return resource, nil
}

func (r *Resources) Get(id string) (*oapi.Resource, bool) {
	return r.repo.Resources.Get(id)
}

func (r *Resources) Remove(ctx context.Context, id string) {
	_, span := tracer.Start(ctx, "Remove", trace.WithAttributes(
		attribute.String("resource.id", id),
	))
	defer span.End()

	resource, ok := r.repo.Resources.Get(id)
	if !ok || resource == nil {
		return
	}

	// Clean up relationships for this resource
	entity := relationships.NewResourceEntity(resource)
	r.store.Relations.RemoveForEntity(ctx, entity)

	r.repo.Resources.Remove(id)
	r.store.changeset.RecordDelete(resource)
}

func (r *Resources) Items() map[string]*oapi.Resource {
	return r.repo.Resources.Items()
}

func (r *Resources) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	for _, resource := range r.repo.Resources.Items() {
		if resource.Identifier == identifier {
			return resource, true
		}
	}
	return nil, false
}

func (r *Resources) Variables(resourceId string) map[string]*oapi.ResourceVariable {
	variables := make(map[string]*oapi.ResourceVariable, 25)
	for _, variable := range r.repo.ResourceVariables.Items() {
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
