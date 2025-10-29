import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { Event, sendGoEvent } from "@ctrlplane/events";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

// const upsertDeploymentVersion: AsyncTypedHandler<
//   "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/versions",
//   "post"
// > = async (req, res) => {
//   const { workspaceId, deploymentId } = req.params;
//   const { body } = req;

//   const version: WorkspaceEngine["schemas"]["DeploymentVersion"] = {
//     config: body.config ?? {},
//     jobAgentConfig: body.jobAgentConfig ?? {},
//     deploymentId,
//     status: body.status ?? "unspecified",
//     tag: body.tag,
//     name: body.name ?? body.tag,
//     createdAt: new Date().toISOString(),
//     id: uuidv4(),
//   };

//   const existingVersion = await getExistingDeploymentVersion(
//     workspaceId,
//     deploymentId,
//     body.tag,
//   );
//   if (existingVersion == null) {
//     sendGoEvent({
//       workspaceId,
//       eventType: Event.DeploymentVersionCreated,
//       timestamp: Date.now(),
//       data: version,
//     });
//     res.status(201).json(version);
//     return;
//   }

//   sendGoEvent({
//     workspaceId,
//     eventType: Event.DeploymentVersionUpdated,
//     timestamp: Date.now(),
//     data: version,
//   });
//   res.status(200).json(version);
//   return;
// };

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

  const { systemId } = deploymentResponse.data;

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

export const deploymentVersionsRouter = Router({ mergeParams: true })
  .post(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(createUserApprovalRecord),
  )
  .put(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(createUserApprovalRecord),
  );
