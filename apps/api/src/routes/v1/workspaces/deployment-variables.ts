import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deploymentVariable,
  deploymentVariableValue,
} from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";

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

  const variableData: WorkspaceEngine["schemas"]["DeploymentVariable"] = {
    id: variableId,
    deploymentId: body.deploymentId,
    key: body.key,
    description: body.description ?? "",
    defaultValue: body.defaultValue ?? undefined,
  };

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableUpdated,
    timestamp: Date.now(),
    data: variableData,
  });

  res.status(202).json({
    id: variableId,
    message: "Deployment variable update requested",
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
    .where(eq(deploymentVariable.id, variableId))
    .then(takeFirstOrNull);

  if (variable == null)
    throw new ApiError("Deployment variable not found", 404);

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableDeleted,
    timestamp: Date.now(),
    data: {
      id: variable.id,
      deploymentId: variable.deploymentId,
      key: variable.key,
      description: variable.description ?? "",
      defaultValue:
        (variable.defaultValue as WorkspaceEngine["schemas"]["DeploymentVariable"]["defaultValue"]) ??
        undefined,
    },
  });

  res.status(202).json({
    id: variableId,
    message: "Deployment variable deletion requested",
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

  if (body.resourceSelector != null) {
    const isValid = validResourceSelector(body.resourceSelector);
    if (!isValid) throw new ApiError("Invalid resource selector", 400);
  }

  const valueData: WorkspaceEngine["schemas"]["DeploymentVariableValue"] = {
    id: valueId,
    deploymentVariableId: body.deploymentVariableId,
    priority: body.priority,
    resourceSelector: body.resourceSelector ?? undefined,
    value: body.value,
  };

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableValueUpdated,
    timestamp: Date.now(),
    data: valueData,
  });

  res.status(202).json({
    id: valueId,
    message: "Deployment variable value update requested",
  });
};

const deleteDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, valueId } = req.params;

  const value = await db
    .select()
    .from(deploymentVariableValue)
    .where(eq(deploymentVariableValue.id, valueId))
    .then(takeFirstOrNull);

  if (value == null)
    throw new ApiError("Deployment variable value not found", 404);

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableValueDeleted,
    timestamp: Date.now(),
    data: {
      id: value.id,
      deploymentVariableId: value.deploymentVariableId,
      value:
        value.value as WorkspaceEngine["schemas"]["DeploymentVariableValue"]["value"],
      resourceSelector:
        (value.resourceSelector as unknown as WorkspaceEngine["schemas"]["DeploymentVariableValue"]["resourceSelector"]) ??
        undefined,
      priority: value.priority,
    },
  });

  res.status(202).json({
    id: valueId,
    message: "Deployment variable value deletion requested",
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
