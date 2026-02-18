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
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("events/handler/resources")

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
	ctx, span := tracer.Start(ctx, "HandleResourceProviderSetResources")
	defer span.End()

	var payload struct {
		ProviderId string  `json:"providerId"`
		BatchId    *string `json:"batchId,omitempty"`
	}
	if err := json.Unmarshal(event.Data, &payload); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to unmarshal payload")
		return err
	}

	span.SetAttributes(
		attribute.String("provider.id", payload.ProviderId),
		attribute.String("workspace.id", ws.ID),
	)

	if payload.BatchId == nil {
		err := fmt.Errorf("batchId is required - resources must be cached via /cache-batch endpoint")
		span.RecordError(err)
		span.SetStatus(codes.Error, "missing batchId")
		return err
	}
	span.SetAttributes(attribute.String("batch.id", *payload.BatchId))

	// Retrieve from in-memory cache
	cache := store.GetResourceProviderBatchCache()
	batch, err := cache.Retrieve(ctx, *payload.BatchId)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "failed to retrieve cached batch")
		log.Error("Failed to retrieve cached batch", "error", err, "batchId", *payload.BatchId)
		return err
	}

	// Verify provider ID matches
	if batch.ProviderId != payload.ProviderId {
		err := fmt.Errorf("provider ID mismatch: expected %s, got %s",
			payload.ProviderId, batch.ProviderId)
		span.RecordError(err)
		span.SetStatus(codes.Error, "provider ID mismatch")
		return err
	}

	resources := batch.Resources
	span.SetAttributes(attribute.Int("batch.resource_count", len(resources)))

	// Ensure all resources have the correct workspace ID
	for _, resource := range resources {
		resource.WorkspaceId = ws.ID
	}

	// Build identifier map using targeted query (only fetches resources matching incoming identifiers)
	_, buildMapSpan := tracer.Start(ctx, "BuildIdentifierMap")
	incomingIdentifiers := make([]string, 0, len(resources))
	for _, resource := range resources {
		incomingIdentifiers = append(incomingIdentifiers, resource.Identifier)
	}
	identifierMap := ws.Resources().GetByIdentifiers(incomingIdentifiers)
	buildMapSpan.SetAttributes(attribute.Int("existing_resources", len(identifierMap)))
	buildMapSpan.End()

	// Process new resource identifiers
	processedResources := make([]*oapi.Resource, 0, len(resources))
	newResourceIdentifiers := make(map[string]bool)

	for _, resource := range resources {
		newResourceIdentifiers[resource.Identifier] = true

		if existingResource, ok := identifierMap[resource.Identifier]; ok {
			resource.Id = existingResource.Id
		} else if resource.Id == "" {
			resource.Id = uuid.New().String()
		}

		processedResources = append(processedResources, resource)
	}

	// Find resources to delete (belong to this provider but not in new set)
	_, findDeletesSpan := tracer.Start(ctx, "FindResourcesToDelete")
	providerResources := ws.Resources().ListByProviderID(payload.ProviderId)
	var resourcesToDelete []*oapi.Resource
	for _, resource := range providerResources {
		if !newResourceIdentifiers[resource.Identifier] {
			resourcesToDelete = append(resourcesToDelete, resource)
		}
	}
	findDeletesSpan.SetAttributes(
		attribute.Int("provider_resources", len(providerResources)),
		attribute.Int("delete_count", len(resourcesToDelete)),
	)
	findDeletesSpan.End()

	// Delete removed resources: in-memory cleanup then single batch DB delete
	if len(resourcesToDelete) > 0 {
		_, deleteSpan := tracer.Start(ctx, "DeleteRemovedResources", trace.WithAttributes(
			attribute.Int("delete_count", len(resourcesToDelete)),
		))
		for _, resource := range resourcesToDelete {
			ws.Store().RelationshipIndexes.RemoveEntity(ctx, resource.Id)
			ws.ReleaseTargets().RemoveForResource(ctx, resource.Id)
		}
		if err := ws.Resources().BulkRemove(ctx, resourcesToDelete); err != nil {
			deleteSpan.RecordError(err)
			deleteSpan.SetStatus(codes.Error, "bulk remove failed")
			deleteSpan.End()
			span.RecordError(err)
			span.SetStatus(codes.Error, "bulk remove failed")
			return err
		}
		deleteSpan.End()
	}

	// Pre-process resources for upsert: resolve IDs, timestamps, and change detection
	_, preprocessSpan := tracer.Start(ctx, "PreprocessResources", trace.WithAttributes(
		attribute.Int("processed_count", len(processedResources)),
	))

	type upsertEntry struct {
		resource *oapi.Resource
		isNew    bool
	}
	upsertEntries := make([]upsertEntry, 0, len(processedResources))
	resourcesToUpsert := make([]*oapi.Resource, 0, len(processedResources))
	newCount := 0
	unchangedCount := 0
	skippedCount := 0

	for _, resource := range processedResources {
		existingResource, exists := identifierMap[resource.Identifier]

		if exists {
			if existingResource.ProviderId != nil && *existingResource.ProviderId != payload.ProviderId {
				log.Warn(
					"Skipping resource with identifier that belongs to another provider",
					"identifier", resource.Identifier,
					"existingProviderId", *existingResource.ProviderId,
					"newProviderId", payload.ProviderId,
				)
				skippedCount++
				continue
			}
			resource.Id = existingResource.Id
			resource.CreatedAt = existingResource.CreatedAt
			resource.ProviderId = &payload.ProviderId

			if len(diffcheck.HasResourceChanges(existingResource, resource)) == 0 {
				unchangedCount++
				continue
			}

			now := time.Now()
			resource.UpdatedAt = &now
		} else {
			resource.CreatedAt = time.Now()
			resource.UpdatedAt = &resource.CreatedAt
			resource.ProviderId = &payload.ProviderId
			newCount++
		}

		resourcesToUpsert = append(resourcesToUpsert, resource)
		upsertEntries = append(upsertEntries, upsertEntry{
			resource: resource,
			isNew:    !exists,
		})
	}

	preprocessSpan.SetAttributes(
		attribute.Int("new_count", newCount),
		attribute.Int("changed_count", len(resourcesToUpsert)),
		attribute.Int("unchanged_count", unchangedCount),
		attribute.Int("skipped_count", skippedCount),
	)
	preprocessSpan.End()

	// Only upsert resources that actually changed
	if len(resourcesToUpsert) > 0 {
		_, upsertSpan := tracer.Start(ctx, "BulkUpsertResources", trace.WithAttributes(
			attribute.Int("upsert_count", len(resourcesToUpsert)),
		))
		if err := ws.Resources().BulkUpsert(ctx, resourcesToUpsert); err != nil {
			upsertSpan.RecordError(err)
			upsertSpan.SetStatus(codes.Error, "bulk upsert failed")
			upsertSpan.End()
			span.RecordError(err)
			span.SetStatus(codes.Error, "bulk upsert failed")
			return err
		}
		upsertSpan.End()
	}

	// Update in-memory relationship indexes and release targets for changed resources
	_, postProcessSpan := tracer.Start(ctx, "UpdateRelationshipsAndReleaseTargets", trace.WithAttributes(
		attribute.Int("changed_count", len(upsertEntries)),
	))

	for _, entry := range upsertEntries {
		if entry.isNew {
			ws.Store().RelationshipIndexes.AddEntity(ctx, entry.resource.Id)
		} else {
			ws.Store().RelationshipIndexes.DirtyEntity(ctx, entry.resource.Id)
		}

		releaseTargets, err := computeReleaseTargets(ctx, ws, entry.resource)
		if err != nil {
			postProcessSpan.RecordError(err)
			postProcessSpan.SetStatus(codes.Error, "compute release targets failed")
			postProcessSpan.End()
			span.RecordError(err)
			span.SetStatus(codes.Error, "compute release targets failed")
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
	postProcessSpan.End()

	span.SetAttributes(
		attribute.Int("total.deleted", len(resourcesToDelete)),
		attribute.Int("total.upserted", len(resourcesToUpsert)),
		attribute.Int("total.unchanged", unchangedCount),
		attribute.Int("total.new", newCount),
		attribute.Int("total.skipped", skippedCount),
	)
	span.SetStatus(codes.Ok, "set resources completed")

	return nil
}
