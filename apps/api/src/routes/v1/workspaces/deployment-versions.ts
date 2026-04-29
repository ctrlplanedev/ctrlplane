import type { AsyncTypedHandler } from "@/types/api.js";
import { ApiError, asyncHandler } from "@/types/api.js";
import { Router } from "express";

import { and, asc, eq, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { enqueueReleaseTargetsForDeployment } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { validResourceSelector } from "../valid-selector.js";

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

// loadVersionInWorkspace returns the deployment_version row joined with its
// owning deployment, scoped to the requested workspace. Used by the dependency
// endpoints to enforce tenant isolation: a version is reachable only via its
// deployment's workspace_id.
const loadVersionInWorkspace = async (
  workspaceId: string,
  deploymentVersionId: string,
) =>
  db
    .select({ version: schema.deploymentVersion, deployment: schema.deployment })
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

const listDeploymentVersionDependencies: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}/dependencies",
  "get"
> = async (req, res) => {
  const { workspaceId, deploymentVersionId } = req.params;

  const found = await loadVersionInWorkspace(workspaceId, deploymentVersionId);
  if (found == null) throw new ApiError("Deployment version not found", 404);

  const rows = await db
    .select()
    .from(schema.deploymentVersionDependency)
    .where(
      eq(
        schema.deploymentVersionDependency.deploymentVersionId,
        deploymentVersionId,
      ),
    )
    .orderBy(asc(schema.deploymentVersionDependency.dependencyDeploymentId));

  res.status(200).json(rows);
};

const upsertDeploymentVersionDependency: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
  "put"
> = async (req, res) => {
  const { workspaceId, deploymentVersionId, dependencyDeploymentId } =
    req.params;
  const { versionSelector } = req.body;

  if (!validResourceSelector(versionSelector))
    throw new ApiError("Invalid versionSelector CEL expression", 400);

  const found = await loadVersionInWorkspace(workspaceId, deploymentVersionId);
  if (found == null) throw new ApiError("Deployment version not found", 404);

  if (found.deployment.id === dependencyDeploymentId)
    throw new ApiError(
      "A deployment version cannot depend on its own deployment",
      400,
    );

  const targetDeployment = await db.query.deployment.findFirst({
    where: and(
      eq(schema.deployment.id, dependencyDeploymentId),
      eq(schema.deployment.workspaceId, workspaceId),
    ),
  });
  if (targetDeployment == null)
    throw new ApiError("Dependency deployment not found", 404);

  try {
    await db
      .insert(schema.deploymentVersionDependency)
      .values({
        deploymentVersionId,
        dependencyDeploymentId,
        versionSelector,
      })
      .onConflictDoUpdate({
        target: [
          schema.deploymentVersionDependency.deploymentVersionId,
          schema.deploymentVersionDependency.dependencyDeploymentId,
        ],
        set: { versionSelector },
      });
  } catch (error: any) {
    if (error.code === "23503")
      throw new ApiError("Deployment version or deployment not found", 404);
    throw error;
  }

  enqueueReleaseTargetsForDeployment(
    db,
    workspaceId,
    found.deployment.id,
  );

  res.status(202).json({
    id: deploymentVersionId,
    message: "Deployment version dependency upsert requested",
  });
};

const deleteDeploymentVersionDependency: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/deploymentversions/{deploymentVersionId}/dependencies/{dependencyDeploymentId}",
  "delete"
> = async (req, res) => {
  const { workspaceId, deploymentVersionId, dependencyDeploymentId } =
    req.params;

  const found = await loadVersionInWorkspace(workspaceId, deploymentVersionId);
  if (found == null) throw new ApiError("Deployment version not found", 404);

  const deleted = await db
    .delete(schema.deploymentVersionDependency)
    .where(
      and(
        eq(
          schema.deploymentVersionDependency.deploymentVersionId,
          deploymentVersionId,
        ),
        eq(
          schema.deploymentVersionDependency.dependencyDeploymentId,
          dependencyDeploymentId,
        ),
      ),
    )
    .returning()
    .then(takeFirstOrNull);

  if (deleted == null)
    throw new ApiError("Deployment version dependency not found", 404);

  enqueueReleaseTargetsForDeployment(
    db,
    workspaceId,
    found.deployment.id,
  );

  res.status(202).json({
    id: deploymentVersionId,
    message: "Deployment version dependency delete requested",
  });
};

export const deploymentVersionsRouter = Router({ mergeParams: true })
  .put(
    "/:deploymentVersionId/user-approval-records",
    asyncHandler(upsertUserApprovalRecord),
  )
  .patch("/:deploymentVersionId", asyncHandler(updateDeploymentVersion))
  .get(
    "/:deploymentVersionId/dependencies",
    asyncHandler(listDeploymentVersionDependencies),
  )
  .put(
    "/:deploymentVersionId/dependencies/:dependencyDeploymentId",
    asyncHandler(upsertDeploymentVersionDependency),
  )
  .delete(
    "/:deploymentVersionId/dependencies/:dependencyDeploymentId",
    asyncHandler(deleteDeploymentVersionDependency),
  );
