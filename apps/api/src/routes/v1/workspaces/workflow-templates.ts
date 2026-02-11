import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

type WorkflowTemplate = WorkspaceEngine["schemas"]["WorkflowTemplate"];

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

function buildWorkflowTemplate(
  id: string,
  body: {
    name: string;
    inputs: WorkflowTemplate["inputs"];
    jobs: Omit<WorkflowTemplate["jobs"][number], "id">[];
  },
): WorkflowTemplate {
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

const listWorkflowTemplates: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflow-templates",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit = 50, offset = 0 } = req.query as {
    limit?: number;
    offset?: number;
  };

  const result = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflow-templates",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (result.error != null)
    throw new ApiError(
      result.error.error ?? "Failed to list workflow templates",
      result.response.status,
    );

  res.status(200).json(result.data);
};

const getWorkflowTemplate: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}",
  "get"
> = async (req, res) => {
  const { workspaceId, workflowTemplateId } = req.params;
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}",
    { params: { path: { workspaceId, workflowTemplateId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Workflow template not found",
      response.response.status,
    );

  res.status(200).json(response.data);
};

const createWorkflowTemplate: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflow-templates",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const body = req.body;

  validateUniqueInputKeys(body.inputs);
  validateUniqueJobNames(body.jobs);

  const workflowTemplate = buildWorkflowTemplate(uuidv4(), body);

  await sendGoEvent({
    workspaceId,
    eventType: Event.WorkflowTemplateCreated,
    timestamp: Date.now(),
    data: workflowTemplate,
  });

  res.status(201).json(workflowTemplate);
};

const updateWorkflowTemplate: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}",
  "put"
> = async (req, res) => {
  const { workspaceId, workflowTemplateId } = req.params;
  const body = req.body;

  validateUniqueInputKeys(body.inputs);
  validateUniqueJobNames(body.jobs);

  const existing = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}",
    { params: { path: { workspaceId, workflowTemplateId } } },
  );

  if (existing.error != null)
    throw new ApiError(
      existing.error.error ?? "Workflow template not found",
      existing.response.status,
    );

  const workflowTemplate = buildWorkflowTemplate(workflowTemplateId, body);

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.WorkflowTemplateUpdated,
      timestamp: Date.now(),
      data: workflowTemplate,
    });
  } catch {
    throw new ApiError("Failed to update workflow template", 500);
  }

  res.status(202).json(workflowTemplate);
};

const deleteWorkflowTemplate: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, workflowTemplateId } = req.params;

  const existing = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/workflow-templates/{workflowTemplateId}",
    { params: { path: { workspaceId, workflowTemplateId } } },
  );

  if (existing.error != null)
    throw new ApiError(
      existing.error.error ?? "Workflow template not found",
      existing.response.status,
    );

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.WorkflowTemplateDeleted,
      timestamp: Date.now(),
      data: existing.data,
    });
  } catch {
    throw new ApiError("Failed to delete workflow template", 500);
  }

  res.status(202).json(existing.data);
};

export const workflowTemplatesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listWorkflowTemplates))
  .post("/", asyncHandler(createWorkflowTemplate))
  .get("/:workflowTemplateId", asyncHandler(getWorkflowTemplate))
  .put("/:workflowTemplateId", asyncHandler(updateWorkflowTemplate))
  .delete("/:workflowTemplateId", asyncHandler(deleteWorkflowTemplate));
