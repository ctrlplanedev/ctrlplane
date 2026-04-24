import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueReleaseTargetsForDeployment } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

const upsertUserApprovalRecord: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deployment-versions/{deploymentVersionId}/user-approval-records",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentVersionId } = req.params;
  if (req.apiContext == null) throw new ApiError("Unauthorized", 401);
  const { user } = req.apiContext;

  const deploymentVersionEntry = await db
    .select()
    .from(schema.deploymentVersion)
    .innerJoin(
      schema.deployment,
      eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
    )
    .where(
      and(
        eq(schema.deploymentVersion.id, deploymentVersionId),
        eq(schema.deployment.workspaceId, workspaceId),
      ),
    )
    .then(takeFirstOrNull);

  if (deploymentVersionEntry == null) {
    res.status(404).json({ error: "Deployment version not found" });
    return;
  }

  const { deployment } = deploymentVersionEntry;

  const environmentIds = await db
    .select()
    .from(schema.systemDeployment)
    .innerJoin(
      schema.system,
      eq(schema.systemDeployment.systemId, schema.system.id),
    )
    .innerJoin(
      schema.systemEnvironment,
      eq(schema.system.id, schema.systemEnvironment.systemId),
    )
    .where(eq(schema.systemDeployment.deploymentId, deployment.id))
    .then((rows) => rows.map((row) => row.system_environment.environmentId));

  const records = environmentIds.map((environmentId) => ({
    userId: user.id,
    versionId: deploymentVersionId,
    environmentId,
    status: req.body.status,
    createdAt: new Date(),
    reason: req.body.reason,
  }));

  await db
    .insert(schema.userApprovalRecord)
    .values(records)
    .onConflictDoNothing();

  enqueueReleaseTargetsForDeployment(db, workspaceId, deployment.id);

  res.status(202).json({
    id: deploymentVersionId,
    message: "User approval record upserted",
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
    return { ...existingVersion, ...setValues };
  });

  enqueueReleaseTargetsForDeployment(
    db,
    workspaceId,
    updatedVersion.deploymentId,
  );

  res.status(200).json(updatedVersion);
};

export const deploymentVersionsRouter = Router({ mergeParams: true })
  .put(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(upsertUserApprovalRecord),
  )
  .patch("/:deploymentVersionId", asyncHandler(updateDeploymentVersion));
