import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { validResourceSelector } from "../valid-selector.js";
import { deploymentVariablesRouter } from "./deployment-variables.js";

const listDeployments: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments",
    {
      params: {
        path: { workspaceId },
        query: { limit, offset },
      },
    },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Failed to list deployments",
      response.response.status,
    );

  res.json(response.data);
};

const existingDeploymentById = async (
  workspaceId: string,
  deploymentId: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, deploymentId } } },
  );
  if (response.error != null) {
    if (response.response.status === 404) return null;
    throw new ApiError(
      response.error.error ?? "Failed to get deployment",
      response.response.status,
    );
  }

  return response.data;
};

const getDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
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

  res.json(response.data);
};

const deleteDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;

  const deploymentResponse = await existingDeploymentById(
    workspaceId,
    deploymentId,
  );
  const deployment = deploymentResponse?.deployment;

  if (deployment == null) {
    throw new ApiError("Deployment not found", 404);
  }

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.DeploymentDeleted,
      timestamp: Date.now(),
      data: deployment,
    });
  } catch {
    throw new ApiError("Failed to delete deployment", 500);
  }

  res
    .status(202)
    .json({ id: deploymentId, message: "Deployment delete requested" });
};

const postDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const deployment: WorkspaceEngine["schemas"]["Deployment"] = {
    id: uuidv4(),
    metadata: {},
    ...body,
    jobAgentConfig: body.jobAgentConfig ?? {},
  };

  const isValid = await validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.DeploymentCreated,
      timestamp: Date.now(),
      data: deployment,
    });
  } catch {
    throw new ApiError("Failed to create deployment", 500);
  }

  res
    .status(202)
    .json({ id: deployment.id, message: "Deployment creation requested" });
};

const upsertDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  console.log(body);

  const existingDeploymentResponse = await existingDeploymentById(
    workspaceId,
    deploymentId,
  );
  const { deployment } = existingDeploymentResponse ?? {};

  if (deployment == null) {
    try {
      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentCreated,
        timestamp: Date.now(),
        data: {
          metadata: {},
          ...body,
          id: deploymentId,
          jobAgentConfig: body.jobAgentConfig ?? {},
        },
      });
    } catch {
      throw new ApiError("Failed to create deployment", 500);
    }

    res
      .status(202)
      .json({ id: deploymentId, message: "Deployment creation requested" });
    return;
  }

  const isValid = await validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  try {
    await sendGoEvent({
      workspaceId,
      eventType: Event.DeploymentUpdated,
      timestamp: Date.now(),
      data: {
        metadata: {},
        ...deployment,
        ...body,
        jobAgentConfig: body.jobAgentConfig ?? {},
      },
    });
  } catch {
    throw new ApiError("Failed to update deployment", 500);
  }

  res
    .status(202)
    .json({ id: deploymentId, message: "Deployment update requested" });
};

const listDeploymentVersions: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { limit, offset } = req.query;

  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
    {
      params: { path: { workspaceId, deploymentId }, query: { limit, offset } },
    },
  );

  if (response.error != null)
    throw new ApiError(
      response.error.error ?? "Failed to list deployment versions",
      response.response.status,
    );

  res.json(response.data);
};

const createDeploymentVersion: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
  "post"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  const data = {
    ...body,
    config: body.config ?? {},
    jobAgentConfig: body.jobAgentConfig ?? {},
    metadata: body.metadata ?? {},
    deploymentId,
    createdAt: new Date().toISOString(),
    id: uuidv4(),
  };

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVersionUpdated,
    timestamp: Date.now(),
    data,
  });

  res.status(200).json(data);
};

export const deploymentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listDeployments))
  .post("/", asyncHandler(postDeployment))
  .get("/:deploymentId", asyncHandler(getDeployment))
  .put("/:deploymentId", asyncHandler(upsertDeployment))
  .delete("/:deploymentId", asyncHandler(deleteDeployment))
  .get("/:deploymentId/versions", asyncHandler(listDeploymentVersions))
  .post("/:deploymentId/versions", asyncHandler(createDeploymentVersion))
  .use("/:deploymentId/variables", deploymentVariablesRouter);
