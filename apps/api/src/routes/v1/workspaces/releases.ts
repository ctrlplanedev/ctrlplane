import { Router } from "express";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import type { AsyncTypedHandler } from "../../../types/api.js";
import { ApiError, asyncHandler } from "../../../types/api.js";

const getRelease: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/releases/{releaseId}",
  "get"
> = async (req, res) => {
  const { workspaceId, releaseId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/releases/{releaseId}",
    { params: { path: { workspaceId, releaseId } } },
  );
  if (response.error != null)
    throw new ApiError(response.error.error ?? "Unknown error", 500);

  res.json(response.data);
  return;
};

const getReleaseVerifications: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/releases/{releaseId}/verifications",
  "get"
> = async (req, res) => {
  const { workspaceId, releaseId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/releases/{releaseId}/verifications",
    { params: { path: { workspaceId, releaseId } } },
  );
  if (response.error != null)
    throw new ApiError(response.error.error ?? "Unknown error", 500);

  res.json(response.data);
};

export const releaseRouter = Router({ mergeParams: true }).get(
  "/:releaseId",
  asyncHandler(getRelease),
  asyncHandler(getReleaseVerifications),
);
