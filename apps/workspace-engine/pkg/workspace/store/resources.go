package store

import (
	"context"
	"reflect"
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

// resourceHasChanges checks if a resource has meaningful changes that would affect matching.
// It compares fields that are used in CEL filters and ignores timestamp/administrative fields.
func resourceHasChanges(existing, new *oapi.Resource) bool {
	// Compare simple string fields
	if existing.Name != new.Name ||
		existing.Kind != new.Kind ||
		existing.Version != new.Version ||
		existing.Identifier != new.Identifier {
		return true
	}

	// Compare optional ProviderId
	if (existing.ProviderId == nil) != (new.ProviderId == nil) {
		return true
	}
	if existing.ProviderId != nil && new.ProviderId != nil && *existing.ProviderId != *new.ProviderId {
		return true
	}

	// Compare DeletedAt status
	if (existing.DeletedAt == nil) != (new.DeletedAt == nil) {
		return true
	}

	// Compare Metadata map
	if !reflect.DeepEqual(existing.Metadata, new.Metadata) {
		return true
	}

	// Compare Config map
	if !reflect.DeepEqual(existing.Config, new.Config) {
		return true
	}

	return false
}

// getResourceChanges returns a list of field names that have changed between existing and new resource.
// Returns nil if no changes detected.
func getResourceChanges(existing, new *oapi.Resource) []string {
	var changes []string

	if existing.Name != new.Name {
		changes = append(changes, "name")
	}
	if existing.Kind != new.Kind {
		changes = append(changes, "kind")
	}
	if existing.Version != new.Version {
		changes = append(changes, "version")
	}
	if existing.Identifier != new.Identifier {
		changes = append(changes, "identifier")
	}

	// Check ProviderId changes
	if (existing.ProviderId == nil) != (new.ProviderId == nil) {
		changes = append(changes, "providerId")
	} else if existing.ProviderId != nil && new.ProviderId != nil && *existing.ProviderId != *new.ProviderId {
		changes = append(changes, "providerId")
	}

	// Check DeletedAt status
	if (existing.DeletedAt == nil) != (new.DeletedAt == nil) {
		changes = append(changes, "deletedAt")
	}

	// Check Metadata
	if !reflect.DeepEqual(existing.Metadata, new.Metadata) {
		changes = append(changes, "metadata")
	}

	// Check Config
	if !reflect.DeepEqual(existing.Config, new.Config) {
		changes = append(changes, "config")
	}

	if len(changes) == 0 {
		return nil
	}
	return changes
}

// recomputeAll triggers recomputation for all environments, deployments, and release targets
func (r *Resources) recomputeAll(ctx context.Context) {
	ctx, span := tracer.Start(ctx, "RecomputeAll")
	defer span.End()

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
}

// upsertWithoutRecompute performs the upsert operation without triggering recomputation.
// Returns true if there were meaningful changes that would require recomputation.
func (r *Resources) upsertWithoutRecompute(ctx context.Context, resource *oapi.Resource) (bool, error) {
	ctx, span := tracer.Start(ctx, "UpsertWithoutRecompute", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
		attribute.String("resource.identifier", resource.Identifier),
		attribute.String("resource.name", resource.Name),
		attribute.String("resource.kind", resource.Kind),
		attribute.String("resource.version", resource.Version),
	))
	defer span.End()

	// Check if resource already exists to determine if we're creating or updating
	existingResource, exists := r.repo.Resources.Get(resource.Id)
	now := time.Now()

	// Determine operation type
	isCreate := !exists || existingResource == nil
	span.SetAttributes(attribute.Bool("operation.is_create", isCreate))

	// Check if there are meaningful changes that would affect matching
	hasChanges := isCreate || resourceHasChanges(existingResource, resource)
	span.SetAttributes(attribute.Bool("resource.has_changes", hasChanges))

	// Track specific field changes for updates
	if !isCreate && hasChanges {
		changedFields := getResourceChanges(existingResource, resource)
		if changedFields != nil {
			span.SetAttributes(attribute.StringSlice("resource.changed_fields", changedFields))
			span.AddEvent("Resource updated", trace.WithAttributes(
				attribute.StringSlice("fields", changedFields),
			))
		}
	} else if isCreate {
		span.AddEvent("New resource created")
	} else {
		span.AddEvent("No changes detected - resource unchanged")
	}

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

	if hasChanges {
		if cs, ok := changeset.FromContext[any](ctx); ok {
			cs.Record(changeset.ChangeTypeUpsert, resource)
		}

		r.store.changeset.RecordUpsert(resource)
	}

	return hasChanges, nil
}

func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) (*oapi.Resource, error) {
	ctx, span := tracer.Start(ctx, "Upsert", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
	))
	defer span.End()

	hasChanges, err := r.upsertWithoutRecompute(ctx, resource)
	if err != nil {
		return nil, err
	}

	// Only trigger recomputation if there are actual changes
	if hasChanges {
		span.SetAttributes(attribute.Bool("recompute.triggered", true))
		r.recomputeAll(ctx)
	} else {
		span.SetAttributes(attribute.Bool("recompute.triggered", false))
		span.AddEvent("Skipped recomputation - no meaningful changes detected")
	}

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

	// Phase 1: Prepare resources and lookup existing ones
	_, prepSpan := tracer.Start(ctx, "Set.PrepareResources")
	resources := make([]*oapi.Resource, 0, len(setResources))
	newResourceIdentifiers := make(map[string]bool)

	for _, resource := range setResources {
		newResourceIdentifiers[resource.Identifier] = true

		// If resource exists, use its existing ID; otherwise generate a new UUID
		existingResource, ok := r.GetByIdentifier(resource.Identifier)
		if ok {
			resource.Id = existingResource.Id
		} else if resource.Id == "" {
			resource.Id = uuid.New().String()
		}

		resources = append(resources, resource)
	}
	prepSpan.End()

	// Phase 2: Find resources to delete
	_, findDeleteSpan := tracer.Start(ctx, "Set.FindResourcesToDelete")
	var resourcesToDelete []string
	for item := range r.repo.Resources.IterBuffered() {
		resource := item.Val
		if resource.ProviderId != nil && *resource.ProviderId == providerId {
			if !newResourceIdentifiers[resource.Identifier] {
				resourcesToDelete = append(resourcesToDelete, resource.Id)
			}
		}
	}
	findDeleteSpan.SetAttributes(attribute.Int("resources.toDelete.count", len(resourcesToDelete)))
	findDeleteSpan.End()

	// Track if any resources were deleted (which requires recomputation)
	hadDeletions := len(resourcesToDelete) > 0

	// Phase 3: Delete old resources (but skip recomputation for now)
	_, deleteSpan := tracer.Start(ctx, "Set.DeleteResources")
	for _, resourceId := range resourcesToDelete {
		resource, ok := r.repo.Resources.Get(resourceId)
		if !ok || resource == nil {
			continue
		}

		r.repo.Resources.Remove(resourceId)

		if cs, ok := changeset.FromContext[any](ctx); ok {
			cs.Record(changeset.ChangeTypeDelete, resource)
		}

		r.store.changeset.RecordDelete(resource)
	}
	deleteSpan.End()

	// Phase 4: Upsert new resources without triggering recomputation
	_, upsertSpan := tracer.Start(ctx, "Set.UpsertResources")
	hasAnyChanges := hadDeletions
	upsertedCount := 0
	skippedCount := 0
	changedCount := 0
	
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
				skippedCount++
				continue
			}
			// If it belongs to this provider or has no provider, we'll update it
			// Use the existing resource ID to ensure we update, not create
			resource.Id = existingResource.Id
		}

		resource.ProviderId = &providerId

		hasChanges, err := r.upsertWithoutRecompute(ctx, resource)
		if err != nil {
			span.RecordError(err)
			span.SetStatus(codes.Error, "Failed to upsert resource")
			upsertSpan.End()
			return err
		}

		upsertedCount++
		if hasChanges {
			hasAnyChanges = true
			changedCount++
		}
	}
	upsertSpan.SetAttributes(
		attribute.Int("resources.upserted", upsertedCount),
		attribute.Int("resources.changed", changedCount),
		attribute.Int("resources.skipped", skippedCount),
	)
	upsertSpan.End()

	// Phase 5: Recomputation (if needed)
	if hasAnyChanges {
		_, recomputeSpan := tracer.Start(ctx, "Set.Recompute")
		span.SetAttributes(attribute.Bool("recompute.triggered", true))
		span.SetAttributes(attribute.Int("resources.deleted", len(resourcesToDelete)))
		r.recomputeAll(ctx)
		recomputeSpan.End()
	} else {
		span.SetAttributes(attribute.Bool("recompute.triggered", false))
		span.AddEvent("Skipped recomputation - no meaningful changes detected")
	}

	return nil
}
