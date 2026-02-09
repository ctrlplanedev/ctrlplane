import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const getJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
    { params: { path: { workspaceId, jobAgentId } } },
  );

  if (response.error != null)
    throw new ApiError(response.error.error ?? "Job agent not found", response.response.status);

  res.status(200).json(response.data);
};

const upsertJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;
  const { body } = req;

  const agent = {
    id: jobAgentId,
    name: body.name,
    type: body.type,
    workspaceId,
    config: body.config,
    metadata: body.metadata ?? {},
  };

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.JobAgentUpdated,
      timestamp: Date.now(),
      data: agent,
    });
  } catch {
    throw new ApiError("Failed to update job agent", 500);
  }

  res.status(202).json({
    id: jobAgentId,
    message: "Job agent update requested",
  });
};

const deleteJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;
  const jobAgentResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
    { params: { path: { workspaceId, jobAgentId } } },
  );

  if (jobAgentResponse.error != null)
    throw new ApiError(jobAgentResponse.error.error ?? "Job agent not found", jobAgentResponse.response.status);

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.JobAgentDeleted,
      timestamp: Date.now(),
      data: jobAgentResponse.data,
    });
  } catch {
    throw new ApiError("Failed to delete job agent", 500);
  }

  res.status(202).json({
    id: jobAgentId,
    message: "Job agent delete requested",
  });
};

const listJobAgents: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit = 50, offset = 0 } = req.query as {
    limit?: number;
    offset?: number;
  };

  const result = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/job-agents",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (result.error != null)
    throw new ApiError(result.error.error ?? "Failed to list job agents", result.response.status);

  res.status(200).json(result.data);
};

export const jobAgentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listJobAgents))
  .get("/:jobAgentId", asyncHandler(getJobAgent))
  .put("/:jobAgentId", asyncHandler(upsertJobAgent))
  .delete("/:jobAgentId", asyncHandler(deleteJobAgent));
