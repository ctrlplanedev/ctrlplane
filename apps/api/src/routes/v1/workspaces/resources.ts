import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const listResources: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset, cel } = req.query;

  const decodedCel =
    typeof cel === "string" ? decodeURIComponent(cel.replace(/\+/g, " ")) : cel;

  const result = await getClientFor(workspaceId).POST(
    "/v1/workspaces/{workspaceId}/resources/query",
    {
      body: {
        filter: decodedCel != null ? { cel: decodedCel } : undefined,
      },
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (result.error?.error) {
    res.status(500).json({ error: result.error.error });
    return;
  }

  res.status(200).json(result.data);
};

const getResourceByIdentifier: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}",
  "get"
> = async (req, res) => {
  const { workspaceId, identifier } = req.params;

  const resourceIdentifier = encodeURIComponent(identifier);
  const result = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
    { params: { path: { workspaceId, resourceIdentifier } } },
  );

  if (result.data == null) {
    res.status(404).json({ error: "Resource not found" });
    return;
  }

  res.status(200).json(result.data);
};

const getVariablesForResource: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
  "get"
> = async (req, res) => {
  const { workspaceId, identifier } = req.params;
  const { limit, offset } = req.query;

  const resourceIdentifier = encodeURIComponent(identifier);
  const result = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/variables",
    {
      params: { path: { workspaceId, resourceIdentifier } },
      query: { limit, offset },
    },
  );

  if (result.error != null)
    throw new ApiError(
      result.error.error ?? "Failed to get variables for resource",
      500,
    );

  res.status(200).json(result.data);
};

const updateVariablesForResource: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/resources/identifier/{identifier}/variables",
  "patch"
> = async (req, res) => {
  const { workspaceId, identifier } = req.params;
  const { body } = req;

  const resourceIdentifier = encodeURIComponent(identifier);
  const resourceResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
    { params: { path: { workspaceId, resourceIdentifier } } },
  );

  if (resourceResponse.error != null) {
    throw new ApiError(
      resourceResponse.error.error ?? "Failed to get resource",
      500,
    );
  }

  await sendGoEvent({
    workspaceId,
    eventType: Event.ResourceVariablesBulkUpdated,
    timestamp: Date.now(),
    data: { resourceId: resourceResponse.data.id, variables: body },
  });

  res.status(204).end();
};

export const resourceRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listResources))
  .get("/identifier/:identifier", asyncHandler(getResourceByIdentifier))
  .get(
    "/identifier/:identifier/variables",
    asyncHandler(getVariablesForResource),
  )
  .patch(
    "/identifier/:identifier/variables",
    asyncHandler(updateVariablesForResource),
  );
