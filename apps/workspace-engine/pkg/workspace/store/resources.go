package store

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
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
	repo  *repository.InMemoryStore
	store *Store
}

func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) (*oapi.Resource, error) {
	_, span := tracer.Start(ctx, "Upsert", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
	))
	defer span.End()

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

	r.repo.Resources.Remove(id)
	r.store.changeset.RecordDelete(resource)
}

func (r *Resources) Items() map[string]*oapi.Resource {
	return r.repo.Resources
}

func (r *Resources) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	for _, resource := range r.repo.Resources {
		if resource.Identifier == identifier {
			return resource, true
		}
	}
	return nil, false
}

func (r *Resources) Variables(resourceId string) map[string]*oapi.ResourceVariable {
	variables := make(map[string]*oapi.ResourceVariable, 25)
	for _, variable := range r.repo.ResourceVariables {
		if variable.ResourceId != resourceId {
			continue
		}
		variables[variable.Key] = variable
	}
	return variables
}

// Set replaces all resources for a given provider with the provided set of resources.
// Resources belonging to the provider that are not in the new set will be deleted.
// Resources in the new set will be upserted only if:
// - No resource with that identifier exists, OR
// - A resource with that identifier exists but has no provider (providerId is null), OR
// - A resource with that identifier exists and belongs to this provider
// Resources that belong to other providers are ignored and not modified.
func (r *Resources) Set(ctx context.Context, providerId string, setResources []*oapi.Resource) error {
	ctx, span := tracer.Start(ctx, "Set", trace.WithAttributes(
		attribute.String("provider.id", providerId),
		attribute.Int("setResources.count", len(setResources)),
	))
	defer span.End()

	identifierMap := make(map[string]*oapi.Resource)
	for _, resource := range r.repo.Resources {
		identifierMap[resource.Identifier] = resource
	}

	resources := make([]*oapi.Resource, 0, len(setResources))
	newResourceIdentifiers := make(map[string]bool)

	for _, resource := range setResources {
		newResourceIdentifiers[resource.Identifier] = true

		// If resource exists, use its existing ID; otherwise generate a new UUID
		if existingResource, ok := identifierMap[resource.Identifier]; ok {
			resource.Id = existingResource.Id
		} else if resource.Id == "" {
			resource.Id = uuid.New().String()
		}

		resources = append(resources, resource)
	}

	// Phase 2: Find resources to delete
	var resourcesToDelete []string
	for _, resource := range r.repo.Resources {
		if resource.ProviderId != nil && *resource.ProviderId == providerId {
			if !newResourceIdentifiers[resource.Identifier] {
				resourcesToDelete = append(resourcesToDelete, resource.Id)
			}
		}
	}

	for _, resourceId := range resourcesToDelete {
		resource, ok := r.repo.Resources.Get(resourceId)
		if !ok || resource == nil {
			continue
		}

		r.Remove(ctx, resourceId)
	}

	for _, resource := range resources {
		// Check if a resource with this identifier already exists
		// Use the identifierMap we built earlier for O(1) lookup
		existingResource, exists := identifierMap[resource.Identifier]

		if exists {
			// If it belongs to a different provider, skip it
			if existingResource.ProviderId != nil && *existingResource.ProviderId != providerId {
				log.Warn(
					"Skipping resource with identifier that belongs to another provider",
					"identifier", resource.Identifier,
					"existingProviderId", *existingResource.ProviderId,
					"newProviderId", providerId,
				)
				continue
			}
			// If it belongs to this provider or has no provider, we'll update it
			// Use the existing resource ID to ensure we update, not create
			resource.Id = existingResource.Id
			
			// Preserve CreatedAt from existing resource
			resource.CreatedAt = existingResource.CreatedAt
			
			// Always set UpdatedAt when resource is touched by SET operation
			now := time.Now()
			resource.UpdatedAt = &now
		} else {
			resource.CreatedAt = time.Now()
			resource.UpdatedAt = &resource.CreatedAt
		}

		resource.ProviderId = &providerId

		r.Upsert(ctx, resource)
	}

	return nil
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
