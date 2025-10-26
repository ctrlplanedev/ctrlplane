import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

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

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  res.json(response.data ?? []);
};

const getExistingDeploymentVersion = async (
  workspaceId: string,
  deploymentId: string,
  tag: string,
) => {
  const response = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
    { params: { path: { workspaceId, deploymentId } } },
  );

  if (response.error?.error != null)
    throw new ApiError(response.error.error, 500);

  if (response.data == null) return null;

  return response.data.items.find((version) => version.tag === tag) ?? null;
};

const upsertDeploymentVersion: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentId } = req.params;
  const { body } = req;

  const version: WorkspaceEngine["schemas"]["DeploymentVersion"] = {
    config: body.config ?? {},
    jobAgentConfig: body.jobAgentConfig ?? {},
    deploymentId,
    status: body.status ?? "unspecified",
    tag: body.tag,
    name: body.name ?? body.tag,
    createdAt: new Date().toISOString(),
    id: uuidv4(),
  };

  const existingVersion = await getExistingDeploymentVersion(
    workspaceId,
    deploymentId,
    body.tag,
  );
  if (existingVersion == null) {
    sendGoEvent({
      workspaceId,
      eventType: Event.DeploymentVersionCreated,
      timestamp: Date.now(),
      data: version,
    });
    res.status(201).json(version);
    return;
  }

  sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVersionUpdated,
    timestamp: Date.now(),
    data: version,
  });
  res.status(200).json(version);
  return;
};

export const deploymentVersionsRouter = Router({ mergeParams: true })
  .get("/", asyncHandler(listDeploymentVersions))
  .put("/", asyncHandler(upsertDeploymentVersion));
