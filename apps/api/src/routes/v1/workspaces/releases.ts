import { Router } from "express";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";

import type { AsyncTypedHandler } from "../../../types/api.js";
import { ApiError, asyncHandler } from "../../../types/api.js";

const getRelease: AsyncTypedHandler<
  "/v1/workspaces/{workspaceId}/releases/{releaseId}",
  "get"
> = async (req, res) => {
  const { releaseId } = req.params;

  const row = await db.query.release.findFirst({
    where: eq(schema.release.id, releaseId),
    with: {
      version: true,
      variables: true,
    },
  });

  if (row == null) throw new ApiError("Release not found", 404);

  const variables: Record<string, unknown> = {};
  const encryptedVariables: string[] = [];
  for (const v of row.variables) {
    variables[v.key] = v.value;
    if (v.encrypted) encryptedVariables.push(v.key);
  }

  res.json({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    releaseTarget: {
      resourceId: row.resourceId,
      environmentId: row.environmentId,
      deploymentId: row.deploymentId,
    },
    variables,
    encryptedVariables,
    version: {
      id: row.version.id,
      name: row.version.name,
      tag: row.version.tag,
      config: row.version.config,
      jobAgentConfig: row.version.jobAgentConfig,
      deploymentId: row.version.deploymentId,
      status: row.version.status,
      message: row.version.message,
      metadata: row.version.metadata,
      createdAt: row.version.createdAt.toISOString(),
    },
  });
};

export const releaseRouter = Router({ mergeParams: true }).get(
  "/:releaseId",
  asyncHandler(getRelease),
);
