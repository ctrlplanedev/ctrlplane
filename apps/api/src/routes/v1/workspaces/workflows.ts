import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler, NotFoundError } from "@/types/api.js";
import { Router } from "express";
import { z } from "zod";

import { and, count, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { validResourceSelector } from "../valid-selector.js";

const RESOURCE_SELECTOR_INPUT_KEY = "resourceSelector";

type WorkflowCelBody = {
  jobAgents?: { name?: string; selector?: string | null }[];
  inputs?: { key?: string; default?: unknown; selector?: { default?: unknown } | null }[];
};

const assertValidWorkflowCel = (body: WorkflowCelBody) => {
  const check = (expr: unknown, label: string) => {
    if (typeof expr !== "string" || expr.trim() === "") return;
    if (!validResourceSelector(expr))
      throw new ApiError(`Invalid CEL expression for ${label}`, 400, "INVALID_CEL");
  };

  for (const agent of body.jobAgents ?? [])
    check(agent.selector, `job agent '${agent.name ?? "?"}'`);

  for (const input of body.inputs ?? []) {
    if (input.key === RESOURCE_SELECTOR_INPUT_KEY)
      check(input.default, `input '${input.key}'`);
    check(input.selector?.default, `input '${input.key ?? "?"}' selector`);
  }
};

const slugifyWorkflowName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase alphanumerics separated by single hyphens");

const resolveSlug = (provided: string | undefined, name: string) => {
  if (provided != null) {
    const result = slugSchema.safeParse(provided);
    if (!result.success)
      throw new ApiError(
        `Invalid slug: ${result.error.issues[0]?.message ?? "invalid format"}`,
        400,
        "INVALID_SLUG",
      );
    return provided;
  }

  const derived = slugifyWorkflowName(name);
  const derivedResult = slugSchema.safeParse(derived);
  if (!derivedResult.success)
    throw new ApiError(
      `Could not derive a valid slug from name: ${derivedResult.error.issues[0]?.message ?? "invalid format"}. Pass an explicit slug.`,
      400,
      "INVALID_SLUG",
    );
  return derived;
};

const throwOnSlugConflict = async (
  workspaceId: string,
  slug: string,
  error: unknown,
) => {
  if ((error as { code?: string }).code !== "23505") throw error;
  const existing = await db
    .select({ id: schema.workflow.id })
    .from(schema.workflow)
    .where(
      and(
        eq(schema.workflow.workspaceId, workspaceId),
        eq(schema.workflow.slug, slug),
      ),
    )
    .then(takeFirstOrNull);
  throw new ApiError(
    `Workflow slug '${slug}' already exists in this workspace`,
    409,
    "DUPLICATE_SLUG",
    { slug, existingWorkflowId: existing?.id },
  );
};

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

  const items = rows.map(({ id, name, slug, inputs, jobAgents }) => ({
    id,
    name,
    slug,
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
  assertValidWorkflowCel(req.body);
  const slug = resolveSlug(req.body.slug, req.body.name);

  const created = await db
    .insert(schema.workflow)
    .values({ ...req.body, slug, workspaceId })
    .returning()
    .then(takeFirst)
    .catch((error) => throwOnSlugConflict(workspaceId, slug, error));

  const { id, name, inputs, jobAgents } = created;
  res.status(201).json({ id, name, slug, inputs, jobAgents });
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

  const { id, name, slug, inputs, jobAgents } = workflow;
  res.json({ id, name, slug, inputs, jobAgents });
};

const getWorkflowBySlug: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/slug/{slug}",
  "get"
> = async (req, res) => {
  const { workspaceId, slug } = req.params;
  const workflow = await db
    .select()
    .from(schema.workflow)
    .where(
      and(
        eq(schema.workflow.slug, slug),
        eq(schema.workflow.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (workflow == null) throw new NotFoundError("Workflow not found");

  const { id, name, inputs, jobAgents } = workflow;
  res.json({ id, name, slug, inputs, jobAgents });
};

const updateWorkflow: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/{workflowId}",
  "put"
> = async (req, res) => {
  const { workflowId, workspaceId } = req.params;
  assertValidWorkflowCel(req.body);

  if (req.body.slug != null) {
    const result = slugSchema.safeParse(req.body.slug);
    if (!result.success)
      throw new ApiError(
        `Invalid slug: ${result.error.issues[0]?.message ?? "invalid format"}`,
        400,
        "INVALID_SLUG",
      );
  }

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
    .then(takeFirstOrNull)
    .catch((error) => {
      if (req.body.slug != null)
        return throwOnSlugConflict(workspaceId, req.body.slug, error);
      throw error;
    });

  if (updated == null) throw new NotFoundError("Workflow not found");

  const { id, name, slug, inputs, jobAgents } = updated;
  res.status(202).json({ id, name, slug, inputs, jobAgents });
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

  const { id, name, slug, inputs, jobAgents } = deleted;
  res.status(202).json({ id, name, slug, inputs, jobAgents });
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

const createWorkflowRunBySlug: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/workflows/slug/{slug}/runs",
  "post"
> = async (req, res) => {
  const { workspaceId, slug } = req.params;

  const workflow = await db
    .select({ id: schema.workflow.id })
    .from(schema.workflow)
    .where(
      and(
        eq(schema.workflow.slug, slug),
        eq(schema.workflow.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (workflow == null) throw new NotFoundError("Workflow not found");

  const { data, error } = await getClientFor().POST(
    "/v1/workspaces/{workspaceId}/workflows/{workflowId}/runs",
    {
      params: { path: { workspaceId, workflowId: workflow.id } },
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
  .get("/slug/:slug", asyncHandler(getWorkflowBySlug))
  .post("/slug/:slug/runs", asyncHandler(createWorkflowRunBySlug))
  .get("/:workflowId", asyncHandler(getWorkflow))
  .put("/:workflowId", asyncHandler(updateWorkflow))
  .delete("/:workflowId", asyncHandler(deleteWorkflow))
  .post("/:workflowId/runs", asyncHandler(createWorkflowRun));
