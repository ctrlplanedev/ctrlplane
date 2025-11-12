import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

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

  const result = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}",
    { params: { path: { workspaceId, resourceIdentifier: identifier } } },
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

  const result = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/resources/{resourceIdentifier}/variables",
    {
      params: { path: { workspaceId, resourceIdentifier: identifier } },
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

export const resourceRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listResources))
  .get("/:identifier", asyncHandler(getResourceByIdentifier))
  .get("/:identifier/variables", asyncHandler(getVariablesForResource));
