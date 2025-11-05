package store

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/relationships"
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

// getDetailedResourceChanges returns a map of changed property paths in dot notation.
// This provides detailed tracking of which specific config/metadata keys changed.
func getDetailedResourceChanges(old, new *oapi.Resource) map[string]bool {
	changed := make(map[string]bool)

	// Top-level properties
	if old.Name != new.Name {
		changed["name"] = true
	}
	if old.Kind != new.Kind {
		changed["kind"] = true
	}
	if old.Identifier != new.Identifier {
		changed["identifier"] = true
	}
	if old.Version != new.Version {
		changed["version"] = true
	}

	// Config - detect changed keys with dot notation
	if !reflect.DeepEqual(old.Config, new.Config) {
		// Check for changed or added keys in new config
		for key := range new.Config {
			if !reflect.DeepEqual(old.Config[key], new.Config[key]) {
				changed[fmt.Sprintf("config.%s", key)] = true
			}
		}
		// Check for deleted keys
		for key := range old.Config {
			if _, exists := new.Config[key]; !exists {
				changed[fmt.Sprintf("config.%s", key)] = true
			}
		}
	}

	// Metadata - detect changed keys with dot notation
	if !reflect.DeepEqual(old.Metadata, new.Metadata) {
		// Check for changed or added keys in new metadata
		for key := range new.Metadata {
			if old.Metadata[key] != new.Metadata[key] {
				changed[fmt.Sprintf("metadata.%s", key)] = true
			}
		}
		// Check for deleted keys
		for key := range old.Metadata {
			if _, exists := new.Metadata[key]; !exists {
				changed[fmt.Sprintf("metadata.%s", key)] = true
			}
		}
	}

	return changed
}

// checkDeploymentReferencesChangedPaths checks if a deployment has variables that reference
// the given relationship with paths that overlap with the changed property paths.
func checkDeploymentReferencesChangedPaths(
	store *Store,
	deploymentId string,
	relationshipRef string,
	changedPaths map[string]bool,
) bool {
	deploymentVars := store.Deployments.Variables(deploymentId)

	for _, deploymentVar := range deploymentVars {
		values := store.DeploymentVariables.Values(deploymentVar.Id)

		for _, value := range values {
			valueType, err := value.Value.GetType()
			if err != nil || valueType != "reference" {
				continue
			}

			refValue, err := value.Value.AsReferenceValue()
			if err != nil {
				continue
			}

			if refValue.Reference == relationshipRef {
				// Check if any changed path matches this reference path
				refPathStr := strings.Join(refValue.Path, ".")
				for changedPath := range changedPaths {
					// Exact match
					if refPathStr == changedPath {
						return true
					}
					// Changed path is a child of reference path (ref: "config", changed: "config.timeout")
					if strings.HasPrefix(changedPath, refPathStr+".") {
						return true
					}
					// Reference path is a child of changed path (ref: "config.timeout", changed: "config")
					if strings.HasPrefix(refPathStr, changedPath+".") {
						return true
					}
				}
			}
		}
	}

	return false
}

// taintDependentReleaseTargets finds and taints release targets that depend on the updated resource
// through deployment variable references. This enables automatic re-evaluation when referenced
// resource properties change.
func taintDependentReleaseTargets(
	ctx context.Context,
	store *Store,
	updatedResource *oapi.Resource,
	changedPaths map[string]bool,
) {
	changeSet, ok := changeset.FromContext[any](ctx)
	if !ok {
		return
	}

	resourceEntity := relationships.NewResourceEntity(updatedResource)

	// Find resources that reference this one via relationships
	// GetRelatedEntities returns relationships in both directions
	relatedMap, err := store.Relationships.GetRelatedEntities(ctx, resourceEntity)
	if err != nil {
		return
	}

	// Build map of resources that reference the updated resource
	// Direction "from" means these resources point TO our updated resource
	referencingResources := make(map[string]string) // resourceId -> relationshipRef
	for reference, entities := range relatedMap {
		for _, entity := range entities {
			if entity.Direction == oapi.From && entity.EntityType == "resource" {
				referencingResources[entity.EntityId] = reference
			}
		}
	}

	// If no resources reference this one, we're done
	if len(referencingResources) == 0 {
		return
	}

	// Check all release targets
	releaseTargets, err := store.ReleaseTargets.Items(ctx)
	if err != nil {
		return
	}

	for _, rt := range releaseTargets {
		// Does this release target's resource reference the updated resource?
		relationshipRef, hasRef := referencingResources[rt.ResourceId]
		if !hasRef {
			continue
		}

		// Does this deployment have variables that use this reference with changed paths?
		if checkDeploymentReferencesChangedPaths(store, rt.DeploymentId, relationshipRef, changedPaths) {
			changeSet.Record(changeset.ChangeTypeTaint, rt)
		}
	}
}

// recomputeAll triggers recomputation for all environments, deployments, and release targets
func (r *Resources) recomputeAll(ctx context.Context) {
	ctx, span := tracer.Start(ctx, "RecomputeAll")
	defer span.End()

	// Use IterCb instead of IterBuffered to avoid snapshot overhead
	// This eliminates 64+ goroutines and gigabytes of temporary allocations
	for _, environment := range r.store.Environments.Items() {
		if err := r.store.Environments.RecomputeResources(ctx, environment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
			span.RecordError(err)
			span.SetStatus(codes.Error, "Failed to recompute resources for environment")
			log.Error("Failed to recompute resources for environment", "environmentId", environment.Id, "error", err)
		}
	}
	
	for _, deployment := range r.store.Deployments.Items() {
		if err := r.store.Deployments.RecomputeResources(ctx, deployment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
			span.RecordError(err)
			span.SetStatus(codes.Error, "Failed to recompute resources for deployment")
			log.Error("Failed to recompute resources for deployment", "deploymentId", deployment.Id, "error", err)
		}
	}

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
		envs := r.store.Environments.ApplyResourceUpsert(ctx, resource)
		deploys := r.store.Deployments.ApplyResourceUpsert(ctx, resource)
		rt := []*oapi.ReleaseTarget{}
		for _, environment := range envs {
			for _, deployment := range deploys {
				rt = append(rt, &oapi.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId: deployment.Id,
					ResourceId: resource.Id,
				})
			}
		}
		r.store.ReleaseTargets.AddReleaseTargets(ctx, rt)
		// Invalidate this resource AND all entities that might have relationships to it
		r.store.Relationships.InvalidateEntityAndPotentialSources(resource.Id, oapi.RelatableEntityTypeResource)
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

	// Use IterCb instead of IterBuffered to avoid snapshot overhead
	for _, environment := range r.store.Environments.Items() {
		if err := r.store.Environments.RecomputeResources(ctx, environment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
			log.Error("Failed to recompute resources for environment", "environmentId", environment.Id, "error", err)
		}
	}
	
	for _, deployment := range r.store.Deployments.Items() {
		if err := r.store.Deployments.RecomputeResources(ctx, deployment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
			log.Error("Failed to recompute resources for deployment", "deploymentId", deployment.Id, "error", err)
		}
	}

	if err := r.store.ReleaseTargets.Recompute(ctx); err != nil && !materialized.IsAlreadyStarted(err) {
		span.RecordError(err)
		log.Error("Failed to recompute release targets", "error", err)
	}

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, resource)
	}

	r.store.changeset.RecordDelete(resource)

	// Invalidate this resource AND all entities that might have had relationships to it
	r.store.Relationships.InvalidateEntityAndPotentialSources(id, oapi.RelatableEntityTypeResource)
}

func (r *Resources) Items() map[string]*oapi.Resource {
	return r.repo.Resources.Items()
}

func (r *Resources) Has(id string) bool {
	return r.repo.Resources.Has(id)
}

func (r *Resources) GetByIdentifier(identifier string) (*oapi.Resource, bool) {
	var found *oapi.Resource
	r.repo.Resources.IterCb(func(id string, resource *oapi.Resource) {
		if found == nil && resource.Identifier == identifier {
			found = resource
		}
	})
	return found, found != nil
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

// TaintDependentReleaseTargetsOnChange checks if a resource property change affects any
// deployment variables that reference it, and taints the corresponding release targets.
func (r *Resources) TaintDependentReleaseTargetsOnChange(
	ctx context.Context,
	oldResource *oapi.Resource,
	newResource *oapi.Resource,
) {
	changedPaths := getDetailedResourceChanges(oldResource, newResource)
	if len(changedPaths) > 0 {
		taintDependentReleaseTargets(ctx, r.store, newResource, changedPaths)
	}
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

	identifierMap := make(map[string]*oapi.Resource)
	for item := range r.repo.Resources.IterBuffered() {
		identifierMap[item.Val.Identifier] = item.Val
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
	prepSpan.End()

	// Phase 2: Find resources to delete
	var resourcesToDelete []string
	for item := range r.repo.Resources.IterBuffered() {
		resource := item.Val
		if resource.ProviderId != nil && *resource.ProviderId == providerId {
			if !newResourceIdentifiers[resource.Identifier] {
				resourcesToDelete = append(resourcesToDelete, resource.Id)
			}
		}
	}

	// Track if any resources were deleted (which requires recomputation)
	hadDeletions := len(resourcesToDelete) > 0


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
		r.store.Relationships.InvalidateEntityAndPotentialSources(resourceId, oapi.RelatableEntityTypeResource)
	}

	// Phase 4: Upsert new resources without triggering recomputation
	_, upsertSpan := tracer.Start(ctx, "Set.UpsertResources")
	hasAnyChanges := hadDeletions
	upsertedCount := 0
	skippedCount := 0
	changedCount := 0
	changedResourcesWithPaths := make(map[string]map[string]bool) // resourceId -> changed paths

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
				skippedCount++
				continue
			}
			// If it belongs to this provider or has no provider, we'll update it
			// Use the existing resource ID to ensure we update, not create
			resource.Id = existingResource.Id

			// Track what changed for this resource (for dependency tainting)
			changedPaths := getDetailedResourceChanges(existingResource, resource)
			if len(changedPaths) > 0 {
				changedResourcesWithPaths[resource.Id] = changedPaths
			}
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

	// Phase 4.5: Taint release targets that depend on changed resources
	_, taintSpan := tracer.Start(ctx, "Set.TaintDependentReleaseTargets")
	for resourceId, changedPaths := range changedResourcesWithPaths {
		resource, ok := r.Get(resourceId)
		if ok {
			taintDependentReleaseTargets(ctx, r.store, resource, changedPaths)
		}
	}
	taintSpan.SetAttributes(attribute.Int("resources.with_dependents_checked", len(changedResourcesWithPaths)))
	taintSpan.End()

	// Phase 5: Recomputation (if needed)
	if hasAnyChanges {
		_, recomputeSpan := tracer.Start(ctx, "Set.Recompute")
		span.SetAttributes(attribute.Bool("recompute.triggered", true))
		span.SetAttributes(attribute.Int("resources.deleted", len(resourcesToDelete)))
		r.recomputeAll(ctx)
		recomputeSpan.End()

		for id := range changedResourcesWithPaths {
			r.store.Relationships.InvalidateEntityAndPotentialSources(id, oapi.RelatableEntityTypeResource)
		}
	} else {
		span.SetAttributes(attribute.Bool("recompute.triggered", false))
		span.AddEvent("Skipped recomputation - no meaningful changes detected")
	}

	return nil
}
