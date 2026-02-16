import type { AsyncTypedHandler } from "@/types/api.js";
import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { resourceProvider } from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const upsertResourceProvider: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers",
  "put"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { name } = req.body;

  const provider = await db
    .insert(resourceProvider)
    .values({ workspaceId, name })
    .onConflictDoUpdate({
      target: [resourceProvider.workspaceId, resourceProvider.name],
      set: { name },
    })
    .returning().then(takeFirstOrNull);

  res.status(200).json(provider);
};

const getResourceProviderByName: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers/name/{name}",
  "get"
> = async (req, res) => {
  const { workspaceId, name } = req.params;

  const provider = await db
    .select()
    .from(resourceProvider)
    .where(
      and(
        eq(resourceProvider.workspaceId, workspaceId),
        eq(resourceProvider.name, name),
      ),
    )
    .then(takeFirstOrNull);

  if (!provider) {
    res.status(404).json({ error: "Resource provider not found" });
    return;
  }

  res.status(200).json(provider);
};

const setResourceProviderResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers/{providerId}/set",
  "put"
> = async (req, res) => {
  const { workspaceId, providerId } = req.params;
  const { resources } = req.body;

  // Phase 1: Cache the batch in workspace-engine memory
  // Type assertion needed until SDK types are regenerated from OpenAPI spec
  const cacheResponse = await getClientFor(workspaceId).POST(
    "/v1/workspaces/{workspaceId}/resource-providers/cache-batch",
    {
      params: {
        path: { workspaceId },
      },
      body: {
        providerId,
        resources: resources.map((r: any) => ({
          id: "",
          ...r,
          workspaceId,
        })),
      },
    },
  );

  const batchId = cacheResponse.data?.batchId;
  if (batchId == null) {
    res.status(500).json({
      error: "Failed to cache batch",
      details: cacheResponse.error,
    });
    return;
  }

  // Phase 2: Send lightweight Kafka event with batch reference
  // Using type assertion as Event types don't include optional batchId yet
  await sendGoEvent({
    workspaceId,
    eventType: Event.ResourceProviderSetResources,
    timestamp: Date.now(),
    data: { providerId, batchId },
  });

  res.status(202).json({
    ok: true,
    batchId,
    method: "cached",
  });
};

export const resourceProvidersRouter = Router({ mergeParams: true })
  .put("/", asyncHandler(upsertResourceProvider))
  .get("/name/:name", asyncHandler(getResourceProviderByName))
  .put("/:providerId/set", asyncHandler(setResourceProviderResources));
