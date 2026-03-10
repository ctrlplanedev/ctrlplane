import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, count, eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  enqueueAllReleaseTargetsDesiredVersion,
  enqueueManyRelationshipEval,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

const enqueueRelationshipReconciliation = async (workspaceId: string) => {
  const [resources, deployments, environments] = await Promise.all([
    db
      .select({ id: schema.resource.id })
      .from(schema.resource)
      .where(eq(schema.resource.workspaceId, workspaceId)),
    db
      .select({ id: schema.deployment.id })
      .from(schema.deployment)
      .where(eq(schema.deployment.workspaceId, workspaceId)),
    db
      .select({ id: schema.environment.id })
      .from(schema.environment)
      .where(eq(schema.environment.workspaceId, workspaceId)),
  ]);

  const evalItems = [
    ...resources.map((r) => ({
      workspaceId,
      entityType: "resource" as const,
      entityId: r.id,
    })),
    ...deployments.map((d) => ({
      workspaceId,
      entityType: "deployment" as const,
      entityId: d.id,
    })),
    ...environments.map((e) => ({
      workspaceId,
      entityType: "environment" as const,
      entityId: e.id,
    })),
  ];

  await Promise.all([
    enqueueManyRelationshipEval(db, evalItems),
    enqueueAllReleaseTargetsDesiredVersion(db, workspaceId),
  ]);
};

const toRuleResponse = (r: typeof schema.relationshipRule.$inferSelect) => ({
  id: r.id,
  name: r.name,
  description: r.description ?? undefined,
  reference: r.reference,
  cel: r.cel,
  workspaceId: r.workspaceId,
  metadata: r.metadata ?? {},
});

const listRelationshipRules: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { offset: rawOffset, limit: rawLimit } = req.query;

  const limitVal = rawLimit ?? 50;
  const offsetVal = rawOffset ?? 0;

  const [countResult] = await db
    .select({ total: count() })
    .from(schema.relationshipRule)
    .where(eq(schema.relationshipRule.workspaceId, workspaceId));

  const total = countResult?.total ?? 0;

  const rows = await db
    .select()
    .from(schema.relationshipRule)
    .where(eq(schema.relationshipRule.workspaceId, workspaceId))
    .limit(limitVal)
    .offset(offsetVal);

  res.status(200).json({
    items: rows.map(toRuleResponse),
    total,
    offset: offsetVal,
    limit: limitVal,
  });
};

const createRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const [inserted] = await db
    .insert(schema.relationshipRule)
    .values({
      name: body.name,
      description: body.description,
      workspaceId,
      reference: body.reference,
      cel: body.cel,
      metadata: body.metadata,
    })
    .returning();

  if (inserted == null) throw new ApiError("Failed to create rule", 500);

  await enqueueRelationshipReconciliation(workspaceId);

  res.status(201).json(toRuleResponse(inserted));
};

const getRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}",
  "get"
> = async (req, res) => {
  const { workspaceId, relationshipRuleId } = req.params;

  const rule = await db
    .select()
    .from(schema.relationshipRule)
    .where(
      and(
        eq(schema.relationshipRule.id, relationshipRuleId),
        eq(schema.relationshipRule.workspaceId, workspaceId),
      ),
    )
    .then((rows) => rows[0]);

  if (rule == null) throw new ApiError("Relationship rule not found", 404);

  res.status(200).json(toRuleResponse(rule));
};

const deleteRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, relationshipRuleId } = req.params;

  const rule = await db
    .select()
    .from(schema.relationshipRule)
    .where(
      and(
        eq(schema.relationshipRule.id, relationshipRuleId),
        eq(schema.relationshipRule.workspaceId, workspaceId),
      ),
    )
    .then((rows) => rows[0]);

  if (rule == null) throw new ApiError("Relationship rule not found", 404);

  await db
    .delete(schema.relationshipRule)
    .where(eq(schema.relationshipRule.id, relationshipRuleId));

  await enqueueRelationshipReconciliation(workspaceId);

  res.status(200).json({ id: relationshipRuleId });
};

const upsertRelationshipRule: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/relationship-rules/{relationshipRuleId}",
  "put"
> = async (req, res) => {
  const { workspaceId, relationshipRuleId } = req.params;
  const { body } = req;

  const [upserted] = await db
    .insert(schema.relationshipRule)
    .values({
      id: relationshipRuleId,
      name: body.name,
      description: body.description,
      workspaceId,
      reference: body.reference,
      cel: body.cel,
      metadata: body.metadata,
    })
    .onConflictDoUpdate({
      target: schema.relationshipRule.id,
      set: {
        name: body.name,
        description: body.description,
        reference: body.reference,
        cel: body.cel,
        metadata: body.metadata,
      },
    })
    .returning();

  if (upserted == null) throw new ApiError("Failed to upsert rule", 500);

  await enqueueRelationshipReconciliation(workspaceId);

  res.status(200).json(toRuleResponse(upserted));
};

export const relationshipRulesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listRelationshipRules))
  .post("/", asyncHandler(createRelationshipRule))
  .get("/:relationshipRuleId", asyncHandler(getRelationshipRule))
  .put("/:relationshipRuleId", asyncHandler(upsertRelationshipRule))
  .delete("/:relationshipRuleId", asyncHandler(deleteRelationshipRule));
