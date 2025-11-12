import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const createJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const jobAgent = { ...body, id: uuidv4(), workspaceId };
  await sendGoEvent({
    workspaceId,
    eventType: Event.JobAgentCreated,
    timestamp: Date.now(),
    data: jobAgent,
  });

  res.status(201).json(jobAgent);
};

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
    throw new ApiError(response.error.error ?? "Unknown error", 500);

  res.status(200).json(response.data);
};

const updateJobAgent: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, jobAgentId } = req.params;
  const { body } = req;

  const existingAgent = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/job-agents/{jobAgentId}",
    { params: { path: { workspaceId, jobAgentId } } },
  );

  if (existingAgent.error != null)
    throw new ApiError(existingAgent.error.error ?? "Unknown error", 500);

  const updatedAgent = { ...existingAgent.data, ...body };

  await sendGoEvent({
    workspaceId,
    eventType: Event.JobAgentUpdated,
    timestamp: Date.now(),
    data: updatedAgent,
  });

  res.status(200).json(updatedAgent);
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
    throw new ApiError(jobAgentResponse.error.error ?? "Unknown error", 500);

  await sendGoEvent({
    workspaceId,
    eventType: Event.JobAgentDeleted,
    timestamp: Date.now(),
    data: jobAgentResponse.data,
  });

  res.status(202).json(jobAgentResponse.data);
  return;
};

export const jobAgentsRouter = Router({ mergeParams: true })
  .post("/", asyncHandler(createJobAgent))
  .get("/:jobAgentId", asyncHandler(getJobAgent))
  .put("/:jobAgentId", asyncHandler(updateJobAgent))
  .delete("/:jobAgentId", asyncHandler(deleteJobAgent));
