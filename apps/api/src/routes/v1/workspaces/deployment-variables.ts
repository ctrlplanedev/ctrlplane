import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueReleaseTargetsForDeployment } from "@ctrlplane/db/reconcilers";
import {
  deployment,
  deploymentVariable,
  deploymentVariableValue,
} from "@ctrlplane/db/schema";

import { validResourceSelector } from "../valid-selector.js";

const listDeploymentVariablesByDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables",
  "get"
> = async (req, res) => {
  const { deploymentId } = req.params;
  const limit = req.query.limit ?? 100;
  const offset = req.query.offset ?? 0;

  const allVariables = await db
    .select()
    .from(deploymentVariable)
    .where(eq(deploymentVariable.deploymentId, deploymentId));

  const total = allVariables.length;
  const paginatedVariables = allVariables.slice(offset, offset + limit);
  const variableIds = paginatedVariables.map((v) => v.id);

  const values =
    variableIds.length > 0
      ? await db
          .select()
          .from(deploymentVariableValue)
          .where(
            inArray(deploymentVariableValue.deploymentVariableId, variableIds),
          )
      : [];

  const items = paginatedVariables.map((variable) => ({
    variable: {
      id: variable.id,
      deploymentId: variable.deploymentId,
      key: variable.key,
      description: variable.description ?? "",
      defaultValue: variable.defaultValue ?? undefined,
    },
    values: values
      .filter((v) => v.deploymentVariableId === variable.id)
      .map((v) => ({
        id: v.id,
        deploymentVariableId: v.deploymentVariableId,
        value: v.value,
        resourceSelector: v.resourceSelector ?? undefined,
        priority: v.priority,
      })),
  }));

  res.json({ items, total, limit, offset });
};

const getDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
  "get"
> = async (req, res) => {
  const { variableId } = req.params;

  const variable = await db
    .select()
    .from(deploymentVariable)
    .where(eq(deploymentVariable.id, variableId))
    .then(takeFirstOrNull);

  if (variable == null)
    throw new ApiError("Deployment variable not found", 404);

  const values = await db
    .select()
    .from(deploymentVariableValue)
    .where(eq(deploymentVariableValue.deploymentVariableId, variableId));

  res.json({
    variable: {
      id: variable.id,
      deploymentId: variable.deploymentId,
      key: variable.key,
      description: variable.description ?? "",
      defaultValue: variable.defaultValue ?? undefined,
    },
    values: values.map((v) => ({
      id: v.id,
      deploymentVariableId: v.deploymentVariableId,
      value: v.value,
      resourceSelector: v.resourceSelector ?? undefined,
      priority: v.priority,
    })),
  });
};

const upsertDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
  "put"
> = async (req, res) => {
  const { workspaceId, variableId } = req.params;
  const { body } = req;
  const { deploymentId } = req.body;

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
    .insert(deploymentVariable)
    .values({ id: variableId, ...body })
    .onConflictDoUpdate({
      target: [deploymentVariable.deploymentId, deploymentVariable.key],
      set: {
        id: variableId,
        description: body.description ?? "",
        defaultValue: body.defaultValue ?? undefined,
      },
    });

  await enqueueReleaseTargetsForDeployment(db, workspaceId, deploymentId);

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

  const variable = await db
    .select()
    .from(deploymentVariable)
    .innerJoin(deployment, eq(deploymentVariable.deploymentId, deployment.id))
    .where(
      and(
        eq(deploymentVariable.id, variableId),
        eq(deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull)
    .then((row) => row?.deployment_variable ?? null);

  if (variable == null) {
    res.status(404).json({ error: "Deployment variable not found" });
    return;
  }

  await db
    .delete(deploymentVariable)
    .where(eq(deploymentVariable.id, variableId));

  await enqueueReleaseTargetsForDeployment(
    db,
    workspaceId,
    variable.deploymentId,
  );

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

  const value = await db
    .select()
    .from(deploymentVariableValue)
    .where(eq(deploymentVariableValue.id, valueId))
    .then(takeFirstOrNull);

  if (value == null)
    throw new ApiError("Deployment variable value not found", 404);

  res.json({
    ...value,
    resourceSelector: value.resourceSelector ?? undefined,
  });
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

  const variable = await db
    .select()
    .from(deploymentVariable)
    .innerJoin(deployment, eq(deploymentVariable.deploymentId, deployment.id))
    .where(
      and(
        eq(deploymentVariable.id, deploymentVariableId),
        eq(deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull)
    .then((row) => row?.deployment_variable ?? null);

  if (variable == null) {
    res.status(404).json({ error: "Deployment variable not found" });
    return;
  }

  await db
    .insert(deploymentVariableValue)
    .values({
      id: valueId,
      deploymentVariableId,
      priority: body.priority,
      resourceSelector: body.resourceSelector ?? undefined,
      value: body.value,
    })
    .onConflictDoUpdate({
      target: [deploymentVariableValue.id],
      set: {
        priority: body.priority,
        resourceSelector: body.resourceSelector ?? undefined,
        value: body.value,
      },
    });

  await enqueueReleaseTargetsForDeployment(
    db,
    workspaceId,
    variable.deploymentId,
  );

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
    .select()
    .from(deploymentVariableValue)
    .innerJoin(
      deploymentVariable,
      eq(deploymentVariableValue.deploymentVariableId, deploymentVariable.id),
    )
    .innerJoin(deployment, eq(deploymentVariable.deploymentId, deployment.id))
    .where(
      and(
        eq(deploymentVariableValue.id, valueId),
        eq(deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (entry == null) {
    res.status(404).json({ error: "Deployment variable value not found" });
    return;
  }

  const { deployment: dep } = entry;

  await db
    .delete(deploymentVariableValue)
    .where(eq(deploymentVariableValue.id, valueId));

  await enqueueReleaseTargetsForDeployment(db, workspaceId, dep.id);

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
