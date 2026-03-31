import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler, NotFoundError } from "@/types/api.js";
import { Router } from "express";

import { and, count, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const listWorkflows: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const limit = req.query.limit ?? 50;
  const offset = req.query.offset ?? 0;

  const total = await db
    .select({ total: count() })
    .from(schema.workflow)
    .where(eq(schema.workflow.workspaceId, workspaceId))
    .then(takeFirst)
    .then(({ total }) => total);

  const rows = await db
    .select()
    .from(schema.workflow)
    .where(eq(schema.workflow.workspaceId, workspaceId))
    .limit(limit)
    .offset(offset);

  const items = rows.map(({ id, name, inputs, jobAgents }) => ({
    id,
    name,
    inputs,
    jobAgents,
  }));

  res.status(200).json({ items, total, limit, offset });
};

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

  const { id, name, inputs, jobAgents } = created;
  res.status(201).json({ id, name, inputs, jobAgents });
};

const getWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
  "get"
> = async (req, res) => {
  const { workflowId, workspaceId } = req.params;
  const workflow = await db
    .select()
    .from(schema.workflow)
    .where(
      and(
        eq(schema.workflow.id, workflowId),
        eq(schema.workflow.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (workflow == null) throw new NotFoundError("Workflow not found");

  const { id, name, inputs, jobAgents } = workflow;
  res.json({ id, name, inputs, jobAgents });
};

const updateWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
  "put"
> = async (req, res) => {
  const { workflowId, workspaceId } = req.params;
  const updated = await db
    .update(schema.workflow)
    .set(req.body)
    .where(
      and(
        eq(schema.workflow.id, workflowId),
        eq(schema.workflow.workspaceId, workspaceId),
      ),
    )
    .returning()
    .then(takeFirstOrNull);

  if (updated == null) throw new NotFoundError("Workflow not found");

  const { id, name, inputs, jobAgents } = updated;
  res.status(202).json({ id, name, inputs, jobAgents });
};

const deleteWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
  "delete"
> = async (req, res) => {
  const { workflowId, workspaceId } = req.params;
  const deleted = await db
    .delete(schema.workflow)
    .where(
      and(
        eq(schema.workflow.id, workflowId),
        eq(schema.workflow.workspaceId, workspaceId),
      ),
    )
    .returning()
    .then(takeFirstOrNull);

  if (deleted == null) throw new NotFoundError("Workflow not found");

  const { id, name, inputs, jobAgents } = deleted;
  res.status(202).json({ id, name, inputs, jobAgents });
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
  .get("/", asyncHandler(listWorkflows))
  .post("/", asyncHandler(createWorkflow))
  .get("/:workflowId", asyncHandler(getWorkflow))
  .put("/:workflowId", asyncHandler(updateWorkflow))
  .delete("/:workflowId", asyncHandler(deleteWorkflow))
  .post("/:workflowId/runs", asyncHandler(createWorkflowRun));
