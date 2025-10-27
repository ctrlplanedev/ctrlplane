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

const getEnvironmentIds = async (
  workspaceId: string,
  deploymentVersionId: string,
) => {
  const deploymentVersionResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}",
    { params: { path: { workspaceId, deploymentVersionId } } },
  );

  if (deploymentVersionResponse.data == null)
    throw new ApiError("Deployment version not found", 404);
  const { deploymentId } = deploymentVersionResponse.data;

  const systemResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}",
    { params: { path: { workspaceId, systemId: deploymentId } } },
  );

  if (systemResponse.data == null) throw new ApiError("System not found", 404);
  const { environments } = systemResponse.data;

  return environments.map((environment) => environment.id);
};

const upsertUserApprovalRecord: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}/user-approval-records",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentVersionId } = req.params;
  if (req.apiContext == null) throw new ApiError("Unauthorized", 401);
  const { user } = req.apiContext;

  const record: WorkspaceEngine["schemas"]["UserApprovalRecord"] = {
    userId: user.id,
    versionId: deploymentVersionId,
    environmentId: "",
    status: req.body.status,
    createdAt: new Date().toISOString(),
    reason: req.body.reason,
  };

  const environmentIds =
    req.body.environmentIds ??
    (await getEnvironmentIds(workspaceId, deploymentVersionId));

  for (const environmentId of environmentIds)
    await sendGoEvent({
      workspaceId,
      eventType: Event.UserApprovalRecordCreated,
      timestamp: Date.now(),
      data: { ...record, environmentId },
    });
  res.status(200).json({ success: true });
};
export const deploymentVersionIdRouter = Router({ mergeParams: true }).put(
  "/user-approval-records",
  asyncHandler(upsertUserApprovalRecord),
);
