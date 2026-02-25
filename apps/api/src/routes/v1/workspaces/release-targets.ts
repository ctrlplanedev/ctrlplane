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
    throw new ApiError(
      jobsResponse.error.error ?? "Failed to get release target jobs",
      jobsResponse.response.status,
    );

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
    throw new ApiError(
      stateResponse.error.error ?? "Failed to get release target state",
      stateResponse.response.status,
    );

  res.status(200).json(stateResponse.data);
};

const getReleaseTargetStates: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/state",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const statesResponse = await getClientFor(workspaceId).POST(
    "/v1/workspaces/{workspaceId}/release-targets/state",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
      body: req.body,
    },
  );

  if (statesResponse.error != null)
    throw new ApiError(
      statesResponse.error.error ?? "Failed to get release target states",
      statesResponse.response.status,
    );

  res.status(200).json(statesResponse.data);
};

const previewReleaseTargetsForResource: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/release-targets/resource-preview",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const previewResponse = await getClientFor(workspaceId).POST(
    "/v1/workspaces/{workspaceId}/release-targets/resource-preview",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
      body: req.body,
    },
  );

  if (previewResponse.error != null)
    throw new ApiError(
      previewResponse.error.error ?? "Failed to preview release targets",
      previewResponse.response.status,
    );

  res.status(200).json(previewResponse.data);
};

const releaseTargetKeyRouter = Router({ mergeParams: true })
  .get("/jobs", asyncHandler(getReleaseTargetJobs))
  .get("/desired-release", asyncHandler(getReleaseTargetDesiredRelease))
  .get("/state", asyncHandler(getReleaseTargetState));

export const releaseTargetsRouter = Router({ mergeParams: true })
  .post("/state", asyncHandler(getReleaseTargetStates))
  .post("/resource-preview", asyncHandler(previewReleaseTargetsForResource))
  .use("/:releaseTargetKey", releaseTargetKeyRouter);
