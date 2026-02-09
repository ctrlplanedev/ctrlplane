import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { validResourceSelector } from "../valid-selector.js";

// Helper to verify deployment exists
const verifyDeploymentExists = async (
  workspaceId: string,
  deploymentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, deploymentId } } },
  );

  if (response.error != null) {
    throw new ApiError(
      response.error.error ?? "Internal server error",
      response.response.status,
    );
  }

  return response.data;
};

const listDeploymentVariables: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;

  const deploymentResponse = await verifyDeploymentExists(
    workspaceId,
    deploymentId,
  );

  const variables = deploymentResponse.variables;

  res.json(variables);
};

const getDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId, variableId } = req.params;

  const deploymentResponse = await verifyDeploymentExists(
    workspaceId,
    deploymentId,
  );

  const variables = deploymentResponse.variables;
  const variable = variables.find((v) => v.variable.id === variableId);

  if (!variable) {
    throw new ApiError("Deployment variable not found", 404);
  }

  res.json(variable);
};

const upsertDeploymentVariable: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentId, variableId } = req.params;
  const { body } = req;

  // Transform request body to workspace-engine schema
  const deploymentVariable: WorkspaceEngine["schemas"]["DeploymentVariable"] = {
    id: variableId,
    deploymentId,
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
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, deploymentId, variableId } = req.params;

  // Verify deployment and variable exist
  const deploymentResponse = await verifyDeploymentExists(
    workspaceId,
    deploymentId,
  );

  const variables = deploymentResponse.variables;
  const variable = variables.find((v) => v.variable.id === variableId);

  if (!variable) {
    throw new ApiError("Deployment variable not found", 404);
  }

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableDeleted,
    timestamp: Date.now(),
    data: {
      id: variableId,
      deploymentId,
      key: variable.variable.key,
      description: variable.variable.description ?? "",
    },
  });

  res.status(204).end();
};

const listDeploymentVariableValues: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}/values",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId, variableId } = req.params;

  const deploymentResponse = await verifyDeploymentExists(
    workspaceId,
    deploymentId,
  );

  const variables = deploymentResponse.variables;
  const variable = variables.find((v) => v.variable.id === variableId);

  if (!variable) {
    throw new ApiError("Deployment variable not found", 404);
  }

  const values = variable.values;

  res.json(values);
};

const getDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}/values/{valueId}",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId, variableId, valueId } = req.params;

  const deploymentResponse = await verifyDeploymentExists(
    workspaceId,
    deploymentId,
  );

  const variables = deploymentResponse.variables;
  const variable = variables.find((v) => v.variable.id === variableId);

  if (!variable) {
    throw new ApiError("Deployment variable not found", 404);
  }

  const value = variable.values.find((v) => v.id === valueId);

  if (!value) {
    throw new ApiError("Deployment variable value not found", 404);
  }

  res.json(value);
};

const upsertDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}/values/{valueId}",
  "put"
> = async (req, res) => {
  const { workspaceId, variableId, valueId } = req.params;
  const { body } = req;

  // Validate resource selector if provided
  if (body.resourceSelector != null) {
    const isValid = await validResourceSelector(body.resourceSelector);
    if (!isValid) {
      throw new ApiError("Invalid resource selector", 400);
    }
  }

  // Transform request body to workspace-engine schema
  const deploymentVariableValue: WorkspaceEngine["schemas"]["DeploymentVariableValue"] =
  {
    id: valueId,
    deploymentVariableId: variableId,
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

  res.status(204).end();
};

const deleteDeploymentVariableValue: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/variables/{variableId}/values/{valueId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, deploymentId, variableId, valueId } = req.params;

  // Verify deployment, variable, and value exist
  const deploymentResponse = await verifyDeploymentExists(
    workspaceId,
    deploymentId,
  );

  const variables = deploymentResponse.variables;
  const variable = variables.find((v) => v.variable.id === variableId);

  if (!variable) {
    throw new ApiError("Deployment variable not found", 404);
  }

  const value = variable.values.find((v) => v.id === valueId);

  if (!value) {
    throw new ApiError("Deployment variable value not found", 404);
  }

  // Send Go event (workspace-engine consumes these events)
  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVariableValueDeleted as any,
    timestamp: Date.now(),
    data: value,
  });

  res.status(204).end();
};

export const deploymentVariablesRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listDeploymentVariables))
  .get("/:variableId", asyncHandler(getDeploymentVariable))
  .put("/:variableId", asyncHandler(upsertDeploymentVariable))
  .delete("/:variableId", asyncHandler(deleteDeploymentVariable))
  .get("/:variableId/values", asyncHandler(listDeploymentVariableValues))
  .get("/:variableId/values/:valueId", asyncHandler(getDeploymentVariableValue))
  .put(
    "/:variableId/values/:valueId",
    asyncHandler(upsertDeploymentVariableValue),
  )
  .delete(
    "/:variableId/values/:valueId",
    asyncHandler(deleteDeploymentVariableValue),
  );
