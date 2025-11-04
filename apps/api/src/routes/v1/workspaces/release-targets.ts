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
    throw new ApiError(jobsResponse.error.error ?? "Unknown error", 500);

  res.status(200).json(jobsResponse.data);
};

const releaseTargetKeyRouter = Router({ mergeParams: true }).get(
  "/jobs",
  asyncHandler(getReleaseTargetJobs),
);

export const releaseTargetsRouter = Router({ mergeParams: true }).use(
  "/:releaseTargetKey",
  releaseTargetKeyRouter,
);
