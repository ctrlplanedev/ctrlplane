import { Router } from "express";

import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import type { AsyncTypedHandler } from "../../../types/api.js";
import { ApiError, asyncHandler } from "../../../types/api.js";

const getReleaseTargetJobs: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/jobs",
  "get"
> = async (req, res) => {
  const { workspaceId, releaseTargetKey } = req.params;
  const { limit, offset, cel } = req.query;

  const jobsResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/jobs",
    {
      params: {
        path: { workspaceId, releaseTargetKey },
        query: { limit, offset, cel },
      },
    },
  );

  if (jobsResponse.error != null)
    throw new ApiError(jobsResponse.error.error ?? "Failed to get release target jobs", jobsResponse.response.status);

  res.status(200).json(jobsResponse.data);
};

const getReleaseTargetDesiredRelease: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/desired-release",
  "get"
> = async (req, res) => {
  const { workspaceId, releaseTargetKey } = req.params;

  const desiredReleaseResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/desired-release",
    { params: { path: { workspaceId, releaseTargetKey } } },
  );

  if (desiredReleaseResponse.error != null)
    throw new ApiError(
      desiredReleaseResponse.error.error ?? "Failed to get desired release",
      desiredReleaseResponse.response.status,
    );

  res.status(200).json(desiredReleaseResponse.data);
};

const getReleaseTargetState: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/state",
  "get"
> = async (req, res) => {
  const { workspaceId, releaseTargetKey } = req.params;
  const { bypassCache } = req.query;

  const stateResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/state",
    {
      params: {
        path: { workspaceId, releaseTargetKey },
        query: { bypassCache },
      },
    },
  );

  if (stateResponse.error != null)
    throw new ApiError(stateResponse.error.error ?? "Failed to get release target state", stateResponse.response.status);

  res.status(200).json(stateResponse.data);
};

const releaseTargetKeyRouter = Router({ mergeParams: true })
  .get("/jobs", asyncHandler(getReleaseTargetJobs))
  .get("/desired-release", asyncHandler(getReleaseTargetDesiredRelease))
  .get("/state", asyncHandler(getReleaseTargetState));

export const releaseTargetsRouter = Router({ mergeParams: true }).use(
  "/:releaseTargetKey",
  releaseTargetKeyRouter,
);
