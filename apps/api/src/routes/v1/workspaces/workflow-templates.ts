import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import yaml from "yaml";
import z from "zod";

import { Event, sendGoEvent } from "@ctrlplane/events";

const workflowStringInputSchema = z.object({
  type: z.literal("string"),
  default: z.string().optional(),
});

const workflowNumberInputSchema = z.object({
  type: z.literal("number"),
  default: z.number().optional(),
});

const workflowBooleanInputSchema = z.object({
  type: z.literal("boolean"),
  default: z.boolean().optional(),
});

const workflowInputSchema = z.union([
  workflowStringInputSchema,
  workflowNumberInputSchema,
  workflowBooleanInputSchema,
]);

const workflowJobTemplateSchema = z.object({
  ref: z.string(),
  config: z.any(),
});

const workflowTemplateSchema = z.object({
  name: z.string(),
  inputs: z.record(workflowInputSchema),
  jobs: z.record(workflowJobTemplateSchema),
});

function validateUniqueInputNames(
  inputs: z.infer<typeof workflowTemplateSchema>["inputs"],
) {
  const inputNames = Object.keys(inputs);
  const uniqueInputNames = new Set(inputNames);
  if (inputNames.length !== uniqueInputNames.size)
    throw new ApiError("Input names must be unique", 400);
}

function validateUniqueJobNames(
  jobs: z.infer<typeof workflowTemplateSchema>["jobs"],
) {
  const jobNames = Object.keys(jobs);
  const uniqueJobNames = new Set(jobNames);
  if (jobNames.length !== uniqueJobNames.size)
    throw new ApiError("Job names must be unique", 400);
}

const createWorkflowTemplate: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflow-templates",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { yaml: yamlString } = req.body;
  const yamlObj = yaml.parse(yamlString);

  const parsedResult = workflowTemplateSchema.safeParse(yamlObj);
  if (!parsedResult.success)
    throw new ApiError("Invalid workflow template", 400);

  const { data: template } = parsedResult;
  validateUniqueInputNames(template.inputs);
  validateUniqueJobNames(template.jobs);

  const workflowTemplate: WorkspaceEngine["schemas"]["WorkflowTemplate"] = {
    id: uuidv4(),
    name: template.name,
    inputs: Object.entries(template.inputs).map(([name, input]) => {
      if (input.type === "string")
        return { name, type: "string" as const, default: input.default ?? "" };
      if (input.type === "number")
        return { name, type: "number" as const, default: input.default ?? 0 };
      return {
        name,
        type: "boolean" as const,
        default: input.default ?? false,
      };
    }),
    jobs: Object.entries(template.jobs).map(([name, job]) => ({
      id: uuidv4(),
      name,
      ref: job.ref,
      config: job.config ?? {},
    })),
  };

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
