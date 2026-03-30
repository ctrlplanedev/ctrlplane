import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const createWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const created = await db
    .insert(schema.workflow)
    .values({ ...req.body, workspaceId })
    .returning()
    .then(takeFirst);

  res.status(202).json(created);
};

const createWorkflowRun: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}/runs",
  "post"
> = async (req, res) => {
  const { workspaceId, workflowId } = req.params;

  const { data, error } = await getClientFor().POST(
    "/v1/workspaces/{workspaceId}/workflows/{workflowId}/runs",
    {
      params: { path: { workspaceId, workflowId } },
      body: { inputs: req.body.inputs },
    },
  );

  if (error != null)
    throw new ApiError(
      error.error ?? "Failed to create workflow run",
      400,
      "WORKFLOW_RUN_ERROR",
    );

  res.status(201).json(data);
};

export const workflowsRouter = Router({ mergeParams: true })
  .post("/", asyncHandler(createWorkflow))
  .post("/:workflowId/runs", asyncHandler(createWorkflowRun));
