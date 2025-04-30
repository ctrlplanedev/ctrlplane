import type { Tx } from "@ctrlplane/db";
import { TRPCError } from "@trpc/server";

import { and, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

export const getVersionWithMetadata = async (db: Tx, versionId: string) => {
  const v = await db.query.deploymentVersion.findFirst({
    where: eq(SCHEMA.deploymentVersion.id, versionId),
    with: { metadata: true },
  });
  if (v == null)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Deployment version not found: ${versionId}`,
    });
  const metadata = Object.fromEntries(v.metadata.map((m) => [m.key, m.value]));
  return { ...v, metadata };
};

export const getAnyReleaseTargetForDeploymentAndEnvironment = async (
  db: Tx,
  deploymentId: string,
  environmentId: string,
  workspaceId: string,
) => {
  const rt = await db.query.releaseTarget.findFirst({
    where: and(
      eq(SCHEMA.releaseTarget.deploymentId, deploymentId),
      eq(SCHEMA.releaseTarget.environmentId, environmentId),
    ),
  });
  if (rt == null)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: `Release target not found: ${deploymentId} ${environmentId}`,
    });
  return { ...rt, workspaceId };
};
