import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const getJobs: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/jobs",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.status(200).json(response.data);
};

const getJob: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs/{jobId}",
  "get"
> = async (req, res) => {
  const { workspaceId, jobId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/jobs/{jobId}",
    { params: { path: { workspaceId, jobId } } },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.status(200).json(response.data);
};

const getJobWithRelease: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs/{jobId}/with-release",
  "get"
> = async (req, res) => {
  const { workspaceId, jobId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/jobs/{jobId}/with-release",
    { params: { path: { workspaceId, jobId } } },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.status(200).json(response.data);
};

export const jobsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(getJobs))
  .get("/:jobId", asyncHandler(getJob))
  .get("/:jobId/with-release", asyncHandler(getJobWithRelease));
