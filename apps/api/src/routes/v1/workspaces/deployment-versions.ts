import type { AsyncTypedHandler } from "@/types/api.js";
import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueReleaseTargetsForDeployment } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events";

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

  const { createdAt, ...body } = req.body;

  const setValues = {
    ...body,
    ...(createdAt != null ? { createdAt: new Date(createdAt) } : {}),
  };

  const updatedVersion = await db.transaction(async (tx) => {
    const existingVersion = await tx
      .select()
      .from(schema.deploymentVersion)
      .where(eq(schema.deploymentVersion.id, deploymentVersionId))
      .then(takeFirst);
    await tx
      .update(schema.deploymentVersion)
      .set(setValues)
      .where(eq(schema.deploymentVersion.id, deploymentVersionId));
    await enqueueReleaseTargetsForDeployment(
      tx,
      workspaceId,
      existingVersion.deploymentId,
    );
    return { ...existingVersion, ...setValues };
  });

  res.status(200).json(updatedVersion);
};

export const deploymentVersionsRouter = Router({ mergeParams: true })
  .put(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(upsertUserApprovalRecord),
  )
  .patch("/:deploymentVersionId", asyncHandler(updateDeploymentVersion));
