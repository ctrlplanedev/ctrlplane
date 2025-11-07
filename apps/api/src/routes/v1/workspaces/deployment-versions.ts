import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

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

  const deploymentResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
    { params: { path: { workspaceId, deploymentId } } },
  );
  if (deploymentResponse.data == null)
    throw new ApiError("Deployment not found", 404);

  const { deployment } = deploymentResponse.data;
  const { systemId } = deployment;

  const systemResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/systems/{systemId}",
    { params: { path: { workspaceId, systemId } } },
  );

  if (systemResponse.data == null) throw new ApiError("System not found", 404);
  const { environments } = systemResponse.data;

  return environments.map((environment) => environment.id);
};

const createUserApprovalRecord: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/user-approval-records",
  "post"
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

const updateDeploymentVersion: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}",
  "patch"
> = async (req, res) => {
  const { workspaceId, deploymentVersionId } = req.params;
  if (req.apiContext == null) throw new ApiError("Unauthorized", 401);

  const deploymentVersionResponse = await getClientFor(workspaceId).GET(
    "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}",
    { params: { path: { workspaceId, deploymentVersionId } } },
  );

  if (deploymentVersionResponse.error != null)
    throw new ApiError(
      deploymentVersionResponse.error.error ?? "Unknown error",
      deploymentVersionResponse.response.status,
    );
  const { data: deploymentVersion } = deploymentVersionResponse;

  const definedFields = req.body;
  const updatedDeploymentVersion = { ...deploymentVersion, ...definedFields };

  await sendGoEvent({
    workspaceId,
    eventType: Event.DeploymentVersionUpdated,
    timestamp: Date.now(),
    data: updatedDeploymentVersion,
  });

  res.status(200).json(updatedDeploymentVersion);
};

export const deploymentVersionsRouter = Router({ mergeParams: true })
  .post(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(createUserApprovalRecord),
  )
  .put(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(createUserApprovalRecord),
  )
  .patch("/:deploymentVersionId", asyncHandler(updateDeploymentVersion));
