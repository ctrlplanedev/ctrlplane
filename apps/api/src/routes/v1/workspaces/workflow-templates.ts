import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";

type WorkflowTemplate = WorkspaceEngine["schemas"]["WorkflowTemplate"];

function validateUniqueNames(items: { name: string }[], label: string): void {
  const names = items.map((i) => i.name);
  if (new Set(names).size !== names.length)
    throw new ApiError(`${label} names must be unique`, 400);
}

function buildWorkflowTemplate(body: {
  name: string;
  inputs: WorkflowTemplate["inputs"];
  jobs: Omit<WorkflowTemplate["jobs"][number], "id">[];
}): WorkflowTemplate {
  return {
    id: uuidv4(),
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

const createWorkflowTemplate: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflow-templates",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const body = req.body;

  validateUniqueNames(body.inputs, "Input");
  validateUniqueNames(body.jobs, "Job");

  const workflowTemplate = buildWorkflowTemplate(body);

  await sendGoEvent({
    workspaceId,
    eventType: Event.WorkflowTemplateCreated,
    timestamp: Date.now(),
    data: workflowTemplate,
  });

  res.status(201).json(workflowTemplate);
};

export const workflowTemplatesRouter = Router({ mergeParams: true }).post(
  "/",
  asyncHandler(createWorkflowTemplate),
);
