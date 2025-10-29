import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { validResourceSelector } from "../valid-selector.js";
import { deploymentVersionsRouter } from "./deployment-versions.js";

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

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

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
  if (response.error?.error != null)
    throw new ApiError(response.error.error, 404);

  if (response.data == null) return null;

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

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) throw new ApiError("Deployment not found", 404);

  res.json(response.data);
  return;
};

const deleteDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentDeleted,
    timestamp: Date.now(),
    data: {
      id: deploymentId,
      name: "",
      systemId: "",
      slug: "",
      jobAgentConfig: {},
    },
  });

  res.status(204).json({ message: "Deployment deleted successfully" });
  return;
};

const postDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const deployment: WorkspaceEngine["schemas"]["Deployment"] = {
    id: uuidv4(),
    ...body,
    jobAgentConfig: body.jobAgentConfig ?? {},
  };

  console.log(deployment);

  const isValid = await validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentCreated,
    timestamp: Date.now(),
    data: deployment,
  });

  res.status(202).json(deployment);

  return;
};

const upsertDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  const existingDeployment = await existingDeploymentById(
    workspaceId,
    deploymentId,
  );

  if (existingDeployment == null)
    throw new ApiError("Deployment not found", 404);

  const deployment: WorkspaceEngine["schemas"]["Deployment"] = {
    ...existingDeployment,
    ...body,
    id: existingDeployment.id,
    jobAgentConfig: body.jobAgentConfig ?? {},
  };

  const isValid = await validResourceSelector(body.resourceSelector);
  if (!isValid) throw new ApiError("Invalid resource selector", 400);

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentUpdated,
    timestamp: Date.now(),
    data: deployment,
  });

  res.status(202).json(deployment);

  return;
};

export const deploymentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listDeployments))
  .post("/", asyncHandler(postDeployment))
  .get("/:deploymentId", asyncHandler(getDeployment))
  .put("/:deploymentId", asyncHandler(upsertDeployment))
  .delete("/:deploymentId", asyncHandler(deleteDeployment))
  .use("/:deploymentId/versions", deploymentVersionsRouter);
