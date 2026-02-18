import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";
import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

const upsertUserApprovalRecord: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/user-approval-records",
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

  try {
    for (const environmentId of req.body.environmentIds)
      await sendGoEvent({
        workspaceId,
        eventType: Event.UserApprovalRecordCreated,
        timestamp: Date.now(),
        data: { ...record, environmentId },
      });
  } catch {
    throw new ApiError("Failed to update user approval record", 500);
  }

  res.status(202).json({
    id: deploymentVersionId,
    message: "User approval record update requested",
  });
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
  .put(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(upsertUserApprovalRecord),
  )
  .patch("/:deploymentVersionId", asyncHandler(updateDeploymentVersion));
