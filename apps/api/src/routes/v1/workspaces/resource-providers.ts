import type { AsyncTypedHandler } from "@/types/api.js";
import { asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { resourceProvider } from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";

const upsertResourceProvider: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resource-providers",
  "put"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { id, name } = req.body;

  const provider = await db
    .insert(resourceProvider)
    .values({ id, workspaceId, name })
    .onConflictDoUpdate({
      target: [resourceProvider.workspaceId, resourceProvider.name],
      set: { name },
    })
    .returning();

  res.status(200).json(provider[0]);
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

  await sendGoEvent({
    workspaceId,
    eventType: Event.ResourceProviderSetResources,
    timestamp: Date.now(),
    data: {
      providerId,
      resources: resources.map((r) => ({
        id: "",
        ...r,
        workspaceId,
      })),
    },
  });

  res.status(202).json({ ok: true });
};

export const resourceProvidersRouter = Router({ mergeParams: true })
  .put("/", asyncHandler(upsertResourceProvider))
  .get("/name/:name", asyncHandler(getResourceProviderByName))
  .put("/:providerId/set", asyncHandler(setResourceProviderResources));
