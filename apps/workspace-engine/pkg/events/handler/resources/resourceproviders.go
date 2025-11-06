package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/relationships"
	"workspace-engine/pkg/workspace/store"

	"github.com/charmbracelet/log"
	"github.com/google/uuid"
)

func HandleResourceProviderCreated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceProvider := &oapi.ResourceProvider{}
	if err := json.Unmarshal(event.Data, resourceProvider); err != nil {
		return err
	}

	ws.ResourceProviders().Upsert(ctx, resourceProvider.Id, resourceProvider)

	return nil
}

func HandleResourceProviderUpdated(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceProvider := &oapi.ResourceProvider{}
	if err := json.Unmarshal(event.Data, resourceProvider); err != nil {
		return err
	}

	ws.ResourceProviders().Upsert(ctx, resourceProvider.Id, resourceProvider)

	return nil
}

func HandleResourceProviderDeleted(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	resourceProvider := &oapi.ResourceProvider{}
	if err := json.Unmarshal(event.Data, resourceProvider); err != nil {
		return err
	}

	if err := ws.ResourceProviders().Remove(ctx, resourceProvider.Id); err != nil {
		return err
	}

	return nil
}

func HandleResourceProviderSetResources(
	ctx context.Context,
	ws *workspace.Workspace,
	event handler.RawEvent,
) error {
	var payload struct {
		ProviderId string  `json:"providerId"`
		BatchId    *string `json:"batchId,omitempty"`
	}
	if err := json.Unmarshal(event.Data, &payload); err != nil {
		return err
	}

	if payload.BatchId == nil {
		return fmt.Errorf("batchId is required - resources must be cached via /cache-batch endpoint")
	}

	// Retrieve from in-memory cache
	cache := store.GetResourceProviderBatchCache()
	batch, err := cache.Retrieve(ctx, *payload.BatchId)
	if err != nil {
		log.Error("Failed to retrieve cached batch", "error", err, "batchId", *payload.BatchId)
		return err
	}

	// Verify provider ID matches
	if batch.ProviderId != payload.ProviderId {
		return fmt.Errorf("provider ID mismatch: expected %s, got %s",
			payload.ProviderId, batch.ProviderId)
	}

	resources := batch.Resources

	log.Info("Retrieved cached batch",
		"batchId", *payload.BatchId,
		"providerId", payload.ProviderId,
		"resourceCount", len(resources))

	// Ensure all resources have the correct workspace ID
	for _, resource := range resources {
		resource.WorkspaceId = ws.ID
	}

	// Build identifier map for O(1) lookups
	identifierMap := make(map[string]*oapi.Resource)
	for _, resource := range ws.Resources().Items() {
		identifierMap[resource.Identifier] = resource
	}

	// Process new resource identifiers
	processedResources := make([]*oapi.Resource, 0, len(resources))
	newResourceIdentifiers := make(map[string]bool)

	for _, resource := range resources {
		newResourceIdentifiers[resource.Identifier] = true

		// If resource exists, use its existing ID; otherwise generate a new UUID
		if existingResource, ok := identifierMap[resource.Identifier]; ok {
			resource.Id = existingResource.Id
		} else if resource.Id == "" {
			resource.Id = uuid.New().String()
		}

		processedResources = append(processedResources, resource)
	}

	// Find resources to delete (belong to this provider but not in new set)
	var resourcesToDelete []string
	for _, resource := range ws.Resources().Items() {
		if resource.ProviderId != nil && *resource.ProviderId == payload.ProviderId {
			if !newResourceIdentifiers[resource.Identifier] {
				resourcesToDelete = append(resourcesToDelete, resource.Id)
			}
		}
	}

	// Delete removed resources and their relationships
	for _, resourceId := range resourcesToDelete {
		resource, ok := ws.Resources().Get(resourceId)
		if !ok || resource == nil {
			continue
		}

		// Remove relationships involving this resource
		entity := relationships.NewResourceEntity(resource)
		ws.Relations().RemoveForEntity(ctx, entity)

		// Remove the resource
		ws.Resources().Remove(ctx, resourceId)
		ws.ReleaseTargets().RemoveForResource(ctx, resource.Id)
	}

	// Upsert new/updated resources
	for _, resource := range processedResources {
		existingResource, exists := identifierMap[resource.Identifier]

		if exists {
			// If it belongs to a different provider, skip it
			if existingResource.ProviderId != nil && *existingResource.ProviderId != payload.ProviderId {
				log.Warn(
					"Skipping resource with identifier that belongs to another provider",
					"identifier", resource.Identifier,
					"existingProviderId", *existingResource.ProviderId,
					"newProviderId", payload.ProviderId,
				)
				continue
			}
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

		resource.ProviderId = &payload.ProviderId

		// Upsert the resource
		_, err := ws.Resources().Upsert(ctx, resource)
		if err != nil {
			return err
		}

		// Compute and update relationships for this resource
		entity := relationships.NewResourceEntity(resource)
		ws.Relations().RemoveForEntity(ctx, entity)
		newRelations := computeRelations(ctx, ws, resource)
		
		for _, relation := range newRelations {
			ws.Relations().Upsert(ctx, relation)
		}

		// Compute and upsert release targets for this resource
		releaseTargets, err := computeReleaseTargets(ctx, ws, resource)
		if err != nil {
			return err
		}

		oldReleaseTargets := ws.ReleaseTargets().GetForResource(ctx, resource.Id)
		removedReleaseTargets := getRemovedReleaseTargets(oldReleaseTargets, releaseTargets)
		for _, removedReleaseTarget := range removedReleaseTargets {
			ws.ReleaseTargets().Remove(removedReleaseTarget.Key())
		}
	
		for _, releaseTarget := range releaseTargets {
			ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		}
	}

	return nil
}
