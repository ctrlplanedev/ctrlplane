import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { validResourceSelector } from "../valid-selector.js";

const listDeploymentVariablesByDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, deploymentId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Deployment not found",
      response.response.status,
    );

  res.json(response.data.variables);
};

const getDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
  "get"
> = async (req, res) => {
  const { workspaceId, variableId } = req.params;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
    { params: { path: { workspaceId, variableId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Deployment variable not found",
      response.response.status,
    );

  res.json(response.data);
};

const upsertDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
  "put"
> = async (req, res) => {
  const { workspaceId, variableId } = req.params;
  const { body } = req;

  const deploymentVariable: WorkspaceEngine["schemas"]["DeploymentVariable"] = {
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
    data: deploymentVariable,
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

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployment-variables/{variableId}",
    { params: { path: { workspaceId, variableId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Deployment variable not found",
      response.response.status,
    );

  const variable = response.data;

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableDeleted,
    timestamp: Date.now(),
    data: variable,
  });

  res.status(204).end();
};

const getDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
  "get"
> = async (req, res) => {
  const { workspaceId, valueId } = req.params;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
    { params: { path: { workspaceId, valueId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Deployment variable value not found",
      response.response.status,
    );

  res.json(response.data);
};

const upsertDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
  "put"
> = async (req, res) => {
  const { workspaceId, valueId } = req.params;
  const { body } = req;

  if (body.resourceSelector != null) {
    const isValid = await validResourceSelector(body.resourceSelector);
    if (!isValid) throw new ApiError("Invalid resource selector", 400);
  }

  const deploymentVariableValue: WorkspaceEngine["schemas"]["DeploymentVariableValue"] =
    {
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
    data: deploymentVariableValue,
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

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployment-variable-values/{valueId}",
    { params: { path: { workspaceId, valueId } } },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Deployment variable value not found",
      response.response.status,
    );

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableValueDeleted,
    timestamp: Date.now(),
    data: response.data,
  });

  res.status(204).end();
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
