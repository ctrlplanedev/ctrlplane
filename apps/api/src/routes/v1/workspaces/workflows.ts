import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

type Workflow = WorkspaceEngine["schemas"]["Workflow"];

function validateUniqueInputKeys(items: { key: string }[]): void {
  const keys = items.map((i) => i.key);
  if (new Set(keys).size !== keys.length)
    throw new ApiError(`Input keys must be unique`, 400);
}

function validateUniqueJobNames(items: { name: string }[]): void {
  const names = items.map((i) => i.name);
  if (new Set(names).size !== names.length)
    throw new ApiError(`Job names must be unique`, 400);
}

function buildWorkflow(
  id: string,
  body: {
    name: string;
    inputs: Workflow["inputs"];
    jobs: Omit<Workflow["jobs"][number], "id">[];
  },
): Workflow {
  return {
    id,
    name: body.name,
    inputs: body.inputs,
    jobs: body.jobs.map((job) => ({
      id: uuidv4(),
      name: job.name,
      ref: job.ref,
      config: job.config,
    })),
  };
}

const listWorkflows: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit = 50, offset = 0 } = req.query as {
    limit?: number;
    offset?: number;
  };

  const result = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflows",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (result.error != null)
    throw new ApiError(
      result.error.error ?? "Failed to list workflows",
      result.response.status,
    );

  res.status(200).json(result.data);
};

const getWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
  "get"
> = async (req, res) => {
  const { workspaceId, workflowId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
    { params: { path: { workspaceId, workflowId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Workflow not found",
      response.response.status,
    );

  res.status(200).json(response.data);
};

const createWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const body = req.body;

  validateUniqueInputKeys(body.inputs);
  validateUniqueJobNames(body.jobs);

  const workflow = buildWorkflow(uuidv4(), body);

  await sendGoEvent({
    workspaceId,
    eventType: Event.WorkflowCreated,
    timestamp: Date.now(),
    data: workflow,
  });

  res.status(201).json(workflow);
};

const updateWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
  "put"
> = async (req, res) => {
  const { workspaceId, workflowId } = req.params;
  const body = req.body;

  validateUniqueInputKeys(body.inputs);
  validateUniqueJobNames(body.jobs);

  const existing = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
    { params: { path: { workspaceId, workflowId } } },
  );

  if (existing.error != null)
    throw new ApiError(
      existing.error.error ?? "Workflow not found",
      existing.response.status,
    );

  const workflow = buildWorkflow(workflowId, body);

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.WorkflowUpdated,
      timestamp: Date.now(),
      data: workflow,
    });
  } catch {
    throw new ApiError("Failed to update workflow", 500);
  }

  res.status(202).json(workflow);
};

const deleteWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, workflowId } = req.params;

  const existing = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
    { params: { path: { workspaceId, workflowId } } },
  );

  if (existing.error != null)
    throw new ApiError(
      existing.error.error ?? "Workflow not found",
      existing.response.status,
    );

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.WorkflowDeleted,
      timestamp: Date.now(),
      data: existing.data,
    });
  } catch {
    throw new ApiError("Failed to delete workflow", 500);
  }

  res.status(202).json(existing.data);
};

export const workflowsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listWorkflows))
  .post("/", asyncHandler(createWorkflow))
  .get("/:workflowId", asyncHandler(getWorkflow))
  .put("/:workflowId", asyncHandler(updateWorkflow))
  .delete("/:workflowId", asyncHandler(deleteWorkflow));
