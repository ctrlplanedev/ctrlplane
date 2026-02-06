import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
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

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Failed to list jobs",
      response.response.status,
    );

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

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Job not found",
      response.response.status,
    );

  res.status(200).json(response.data);
};

const updateJobStatus: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/jobs/{jobId}/status",
  "put"
> = async (req, res) => {
  const { workspaceId, jobId } = req.params;
  const { body: status } = req;


  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.JobUpdated,
      timestamp: Date.now(),
      data: {
        id: jobId,
        job: {
          id: jobId,
          status,
        } as WorkspaceEngine["schemas"]["Job"],
        fieldsToUpdate: ["status"],
      },
    });
  } catch {
    throw new ApiError("Failed to update job status", 500);
  }

  res.status(202).json({
    id: jobId,
    message: "Job status update requested",
  });
};

export const jobsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(getJobs))
  .get("/:jobId", asyncHandler(getJob))
  .put("/:jobId/status", asyncHandler(updateJobStatus));
