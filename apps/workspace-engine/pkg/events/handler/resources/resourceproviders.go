package resources

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
	"workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	"workspace-engine/pkg/workspace/store"
	"workspace-engine/pkg/workspace/store/diffcheck"

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
	var resourcesToDelete []*oapi.Resource
	for _, resource := range ws.Resources().Items() {
		if resource.ProviderId != nil && *resource.ProviderId == payload.ProviderId {
			if !newResourceIdentifiers[resource.Identifier] {
				resourcesToDelete = append(resourcesToDelete, resource)
			}
		}
	}

	// Delete removed resources: in-memory cleanup then single batch DB delete
	for _, resource := range resourcesToDelete {
		ws.Store().RelationshipIndexes.RemoveEntity(ctx, resource.Id)
		ws.ReleaseTargets().RemoveForResource(ctx, resource.Id)
	}
	if len(resourcesToDelete) > 0 {
		if err := ws.Resources().BulkRemove(ctx, resourcesToDelete); err != nil {
			return err
		}
	}

	// Pre-process resources for upsert: resolve IDs, timestamps, and change detection
	type upsertEntry struct {
		resource   *oapi.Resource
		hasChanged bool
		isNew      bool
	}
	upsertEntries := make([]upsertEntry, 0, len(processedResources))
	resourcesToUpsert := make([]*oapi.Resource, 0, len(processedResources))

	for _, resource := range processedResources {
		existingResource, exists := identifierMap[resource.Identifier]
		hasChanged := true

		if exists {
			if existingResource.ProviderId != nil && *existingResource.ProviderId != payload.ProviderId {
				log.Warn(
					"Skipping resource with identifier that belongs to another provider",
					"identifier", resource.Identifier,
					"existingProviderId", *existingResource.ProviderId,
					"newProviderId", payload.ProviderId,
				)
				continue
			}
			resource.Id = existingResource.Id
			resource.CreatedAt = existingResource.CreatedAt
			now := time.Now()
			resource.UpdatedAt = &now
			hasChanged = len(diffcheck.HasResourceChanges(existingResource, resource)) > 0
		} else {
			resource.CreatedAt = time.Now()
			resource.UpdatedAt = &resource.CreatedAt
		}

		resource.ProviderId = &payload.ProviderId
		resourcesToUpsert = append(resourcesToUpsert, resource)
		upsertEntries = append(upsertEntries, upsertEntry{
			resource:   resource,
			hasChanged: hasChanged,
			isNew:      !exists,
		})
	}

	// Single batch DB upsert for all resources
	if len(resourcesToUpsert) > 0 {
		if err := ws.Resources().BulkUpsert(ctx, resourcesToUpsert); err != nil {
			return err
		}
	}

	// Update in-memory relationship indexes and release targets for changed resources
	for _, entry := range upsertEntries {
		if !entry.hasChanged {
			continue
		}

		if entry.isNew {
			ws.Store().RelationshipIndexes.AddEntity(ctx, entry.resource.Id)
		} else {
			ws.Store().RelationshipIndexes.DirtyEntity(ctx, entry.resource.Id)
		}

		releaseTargets, err := computeReleaseTargets(ctx, ws, entry.resource)
		if err != nil {
			return err
		}

		oldReleaseTargets := ws.ReleaseTargets().GetForResource(ctx, entry.resource.Id)
		removedReleaseTargets := getRemovedReleaseTargets(oldReleaseTargets, releaseTargets)
		for _, removedReleaseTarget := range removedReleaseTargets {
			ws.ReleaseTargets().Remove(removedReleaseTarget.Key())
		}

		for _, releaseTarget := range releaseTargets {
			_ = ws.ReleaseTargets().Upsert(ctx, releaseTarget)
		}
	}

	return nil
}
