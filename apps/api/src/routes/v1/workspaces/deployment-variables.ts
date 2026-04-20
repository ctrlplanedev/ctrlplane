import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, eq, inArray, sql, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueReleaseTargetsForDeployment } from "@ctrlplane/db/reconcilers";
import { deployment, variable, variableValue } from "@ctrlplane/db/schema";

import { validResourceSelector } from "../valid-selector.js";

type VariableValueRow = typeof variableValue.$inferSelect;

const flattenVariableValue = (v: VariableValueRow): unknown => {
  if (v.kind === "literal") return v.literalValue;
  if (v.kind === "ref")
    return { reference: v.refKey, path: v.refPath ?? [] };
  return {
    provider: v.secretProvider,
    key: v.secretKey,
    path: v.secretPath ?? [],
  };
};

const toApiVariableValue = (v: VariableValueRow) => ({
  id: v.id,
  deploymentVariableId: v.variableId,
  value: flattenVariableValue(v),
  resourceSelector: v.resourceSelector ?? undefined,
  priority: v.priority,
});

const listDeploymentVariablesByDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables",
  "get"
> = async (req, res) => {
  const { deploymentId } = req.params;
  const limit = req.query.limit ?? 100;
  const offset = req.query.offset ?? 0;

  const allVariables = await db
    .select()
    .from(variable)
    .where(
      and(
        eq(variable.scope, "deployment"),
        eq(variable.deploymentId, deploymentId),
      ),
    );

  const total = allVariables.length;
  const paginatedVariables = allVariables.slice(offset, offset + limit);
  const variableIds = paginatedVariables.map((v) => v.id);

  const values =
    variableIds.length > 0
      ? await db
          .select()
          .from(variableValue)
          .where(inArray(variableValue.variableId, variableIds))
      : [];

  const items = paginatedVariables.map((v) => ({
    variable: {
      id: v.id,
      deploymentId: v.deploymentId!,
      key: v.key,
      description: v.description ?? "",
    },
    values: values
      .filter((val) => val.variableId === v.id)
      .map(toApiVariableValue),
  }));

  res.json({ items, total, limit, offset });
};

const getDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
  "get"
> = async (req, res) => {
  const { variableId } = req.params;

  const v = await db
    .select()
    .from(variable)
    .where(
      and(eq(variable.id, variableId), eq(variable.scope, "deployment")),
    )
    .then(takeFirstOrNull);

  if (v == null)
    throw new ApiError("Deployment variable not found", 404);

  const values = await db
    .select()
    .from(variableValue)
    .where(eq(variableValue.variableId, variableId));

  res.json({
    variable: {
      id: v.id,
      deploymentId: v.deploymentId!,
      key: v.key,
      description: v.description ?? "",
    },
    values: values.map(toApiVariableValue),
  });
};

const upsertDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
  "put"
> = async (req, res) => {
  const { workspaceId, variableId } = req.params;
  const { deploymentId, key, description } = req.body;

  const dep = await db
    .select()
    .from(deployment)
    .where(
      and(
        eq(deployment.id, deploymentId),
        eq(deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (dep == null) {
    res.status(404).json({ error: "Deployment not found" });
    return;
  }

  await db
    .insert(variable)
    .values({
      id: variableId,
      scope: "deployment",
      deploymentId,
      key,
      description: description ?? null,
    })
    .onConflictDoUpdate({
      target: [variable.deploymentId, variable.key],
      targetWhere: sql`${variable.deploymentId} is not null`,
      set: { description: description ?? null },
    });

  enqueueReleaseTargetsForDeployment(db, workspaceId, deploymentId);

  res.status(202).json({
    id: variableId,
    message: "Deployment variable upserted",
  });
};

const deleteDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, variableId } = req.params;

  const v = await db
    .select({ deploymentId: variable.deploymentId })
    .from(variable)
    .innerJoin(deployment, eq(variable.deploymentId, deployment.id))
    .where(
      and(
        eq(variable.id, variableId),
        eq(variable.scope, "deployment"),
        eq(deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (v == null) {
    res.status(404).json({ error: "Deployment variable not found" });
    return;
  }

  await db.delete(variable).where(eq(variable.id, variableId));

  enqueueReleaseTargetsForDeployment(db, workspaceId, v.deploymentId!);

  res.status(202).json({
    id: variableId,
    message: "Deployment variable deleted",
  });
};

const getDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
  "get"
> = async (req, res) => {
  const { valueId } = req.params;

  const val = await db
    .select()
    .from(variableValue)
    .where(eq(variableValue.id, valueId))
    .then(takeFirstOrNull);

  if (val == null)
    throw new ApiError("Deployment variable value not found", 404);

  res.json(toApiVariableValue(val));
};

const upsertDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
  "put"
> = async (req, res) => {
  const { workspaceId, valueId } = req.params;
  const { body } = req;
  const { deploymentVariableId } = body;

  const isValidCel = validResourceSelector(body.resourceSelector);
  if (!isValidCel) {
    const error = "Invalid resource selector, must be a valid CEL expression";
    res.status(400).json({ error });
    return;
  }

  const owner = await db
    .select({ deploymentId: variable.deploymentId })
    .from(variable)
    .innerJoin(deployment, eq(variable.deploymentId, deployment.id))
    .where(
      and(
        eq(variable.id, deploymentVariableId),
        eq(variable.scope, "deployment"),
        eq(deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (owner == null) {
    res.status(404).json({ error: "Deployment variable not found" });
    return;
  }

  await db
    .insert(variableValue)
    .values({
      id: valueId,
      variableId: deploymentVariableId,
      priority: body.priority,
      resourceSelector: body.resourceSelector ?? null,
      kind: "literal",
      literalValue: body.value,
    })
    .onConflictDoUpdate({
      target: [variableValue.id],
      set: {
        priority: body.priority,
        resourceSelector: body.resourceSelector ?? null,
        kind: "literal",
        literalValue: body.value,
      },
    });

  enqueueReleaseTargetsForDeployment(db, workspaceId, owner.deploymentId!);

  res.status(202).json({
    id: valueId,
    message: "Deployment variable value upserted",
  });
};

const deleteDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, valueId } = req.params;

  const entry = await db
    .select({ deploymentId: variable.deploymentId })
    .from(variableValue)
    .innerJoin(variable, eq(variableValue.variableId, variable.id))
    .innerJoin(deployment, eq(variable.deploymentId, deployment.id))
    .where(
      and(
        eq(variableValue.id, valueId),
        eq(deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (entry == null) {
    res.status(404).json({ error: "Deployment variable value not found" });
    return;
  }

  await db.delete(variableValue).where(eq(variableValue.id, valueId));

  enqueueReleaseTargetsForDeployment(db, workspaceId, entry.deploymentId!);

  res.status(202).json({
    id: valueId,
    message: "Deployment variable value deleted",
  });
};

export const listDeploymentVariablesByDeploymentRouter = Router({
  mergeParams: true,
}).get("/", asyncHandler(listDeploymentVariablesByDeployment));

export const deploymentVariablesRouter = Router({ mergeParams: true })
  .get("/:variableId", asyncHandler(getDeploymentVariable))
  .put("/:variableId", asyncHandler(upsertDeploymentVariable))
  .delete("/:variableId", asyncHandler(deleteDeploymentVariable));

export const deploymentVariableValuesRouter = Router({ mergeParams: true })
  .get("/:valueId", asyncHandler(getDeploymentVariableValue))
  .put("/:valueId", asyncHandler(upsertDeploymentVariableValue))
  .delete("/:valueId", asyncHandler(deleteDeploymentVariableValue));
