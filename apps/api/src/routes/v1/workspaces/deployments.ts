import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { wsEngine } from "@/engine.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";

import { deploymentVersionsRouter } from "./deployment-versions.js";

const listDeployments: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "get"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { limit, offset } = req.query;

  const response = await wsEngine.GET(
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

const getExistingDeployment = async (
  workspaceId: string,
  systemId: string,
  slug: string,
) => {
  const response = await wsEngine.GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}",
    { params: { path: { workspaceId, systemId } } },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) return null;

  const { deployments } = response.data;

  return deployments.find((deployment) => deployment.slug === slug) ?? null;
};

const createDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments",
  "post"
> = async (req, res) => {
  const { workspaceId } = req.params;
  const { body } = req;

  const existingDeployment = await getExistingDeployment(
    workspaceId,
    body.systemId,
    body.slug,
  );

  const deployment: WorkspaceEngine["schemas"]["Deployment"] = {
    id: uuidv4(),
    ...body,
    jobAgentConfig: body.jobAgentConfig ?? {},
  };

  if (existingDeployment != null) {
    const mergedDeployment = { ...existingDeployment, ...deployment };
    sendGoEvent({
      workspaceId,
      eventType: Event.DeploymentUpdated,
      timestamp: Date.now(),
      data: mergedDeployment,
    });
    res.json(mergedDeployment);
    return;
  }

  sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentCreated,
    timestamp: Date.now(),
    data: deployment,
  });
  res.json(deployment);
  return;
};

const getDeployment: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const response = await wsEngine.GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, deploymentId } } },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) throw new ApiError("Deployment not found", 404);

  res.json(response.data);
  return;
};

export const deploymentIdRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(getDeployment))
  .use("/versions", deploymentVersionsRouter);

export const deploymentsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listDeployments))
  .post("/", asyncHandler(createDeployment))
  .use("/:deploymentId", deploymentIdRouter);
