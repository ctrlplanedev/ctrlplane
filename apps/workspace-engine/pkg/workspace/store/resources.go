package store

import (
	"context"
	"sync"
	"time"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
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
	ctx, span := tracer.Start(ctx, "Upsert", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
	))
	defer span.End()

	// Check if resource already exists to determine if we're creating or updating
	existingResource, exists := r.repo.Resources.Get(resource.Id)
	now := time.Now()

	if exists && existingResource != nil {
		// Updating existing resource - preserve CreatedAt, set UpdatedAt
		if !existingResource.CreatedAt.IsZero() {
			resource.CreatedAt = existingResource.CreatedAt
		}
		resource.UpdatedAt = &now
	} else {
		// Creating new resource - set CreatedAt if not already set
		if resource.CreatedAt.IsZero() {
			resource.CreatedAt = now
		}
	}

	r.repo.Resources.Set(resource.Id, resource)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		ctx, span := tracer.Start(ctx, "RecomputeEnvironmentsResources")
		defer span.End()

		defer wg.Done()
		for item := range r.store.Environments.IterBuffered() {
			environment := item.Val
			if err := r.store.Environments.RecomputeResources(ctx, environment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
				span.RecordError(err)
				span.SetStatus(codes.Error, "Failed to recompute resources for environment")
				log.Error("Failed to recompute resources for environment", "environmentId", environment.Id, "error", err)
			}
		}
	}()
	go func() {
		ctx, span := tracer.Start(ctx, "RecomputeDeploymentsResources")
		defer span.End()

		defer wg.Done()
		for item := range r.store.Deployments.IterBuffered() {
			deployment := item.Val
			if err := r.store.Deployments.RecomputeResources(ctx, deployment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
				span.RecordError(err)
				span.SetStatus(codes.Error, "Failed to recompute resources for deployment")
				log.Error("Failed to recompute resources for deployment", "deploymentId", deployment.Id, "error", err)
			}
		}
	}()
	wg.Wait()

	if err := r.store.ReleaseTargets.Recompute(ctx); err != nil && !materialized.IsAlreadyStarted(err) {
		span.RecordError(err)
		log.Error("Failed to recompute release targets", "error", err)
	}

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, resource)
	}

	r.store.changeset.RecordUpsert(resource)

	return resource, nil
}

func (r *Resources) Get(id string) (*oapi.Resource, bool) {
	return r.repo.Resources.Get(id)
}

func (r *Resources) Remove(ctx context.Context, id string) {
	ctx, span := tracer.Start(ctx, "Remove", trace.WithAttributes(
		attribute.String("resource.id", id),
	))
	defer span.End()

	resource, ok := r.repo.Resources.Get(id)
	if !ok || resource == nil {
		return
	}

	r.repo.Resources.Remove(id)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for item := range r.store.Environments.IterBuffered() {
			environment := item.Val
			if err := r.store.Environments.RecomputeResources(ctx, environment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
				log.Error("Failed to recompute resources for environment", "environmentId", environment.Id, "error", err)
			}
		}
	}()
	go func() {
		defer wg.Done()
		for item := range r.store.Deployments.IterBuffered() {
			deployment := item.Val
			if err := r.store.Deployments.RecomputeResources(ctx, deployment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
				log.Error("Failed to recompute resources for deployment", "deploymentId", deployment.Id, "error", err)
			}
		}
	}()
	wg.Wait()

	if err := r.store.ReleaseTargets.Recompute(ctx); err != nil && !materialized.IsAlreadyStarted(err) {
		span.RecordError(err)
		log.Error("Failed to recompute release targets", "error", err)
	}

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, resource)
	}

	r.store.changeset.RecordDelete(resource)
}

func (r *Resources) Items() map[string]*oapi.Resource {
	return r.repo.Resources.Items()
}

func (r *Resources) Has(id string) bool {
	return r.repo.Resources.Has(id)
}

func (r *Resources) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	for item := range r.repo.Resources.IterBuffered() {
		if item.Val.Identifier == identifier {
			return item.Val, true
		}
	}
	return nil, false
}

func (r *Resources) Variables(resourceId string) map[string]*oapi.ResourceVariable {
	variables := make(map[string]*oapi.ResourceVariable, 25)
	for item := range r.repo.ResourceVariables.IterBuffered() {
		if item.Val.ResourceId != resourceId {
			continue
		}
		variables[item.Val.Key] = item.Val
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

	resources := make([]*oapi.Resource, 0, len(setResources))
	newResourceIdentifiers := make(map[string]bool)

	for _, resource := range setResources {
		newResourceIdentifiers[resource.Identifier] = true

		// If resource exists, use its existing ID; otherwise generate a new UUID
		existingResource, ok := r.GetByIdentifier(resource.Identifier)
		if ok {
			log.Warn("Using existing resource", "resource.identifier", resource.Identifier, "resource.id", existingResource.Id)
			resource.Id = existingResource.Id
		} else if resource.Id == "" {
			log.Warn("Creating new resource", "resource.identifier", resource.Identifier)
			resource.Id = uuid.New().String()
		}

		resources = append(resources, resource)
	}

	// Find and delete resources that belong to this provider but aren't in the new set
	var resourcesToDelete []string
	for item := range r.repo.Resources.IterBuffered() {
		resource := item.Val
		if resource.ProviderId != nil && *resource.ProviderId == providerId {
			if !newResourceIdentifiers[resource.Identifier] {
				resourcesToDelete = append(resourcesToDelete, resource.Id)
			}
		}
	}

	// Delete old resources
	for _, resourceId := range resourcesToDelete {
		r.Remove(ctx, resourceId)
	}

	// Upsert new resources, but only if they don't belong to another provider
	for _, resource := range resources {
		// Check if a resource with this identifier already exists
		existingResource, exists := r.GetByIdentifier(resource.Identifier)

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
		}

		resource.ProviderId = &providerId

		log.Warn("Upserting resource", "resource.id", resource.Id)
		if _, err := r.Upsert(ctx, resource); err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "Failed to upsert resource")
			return err
		}
	}

	return nil
}
