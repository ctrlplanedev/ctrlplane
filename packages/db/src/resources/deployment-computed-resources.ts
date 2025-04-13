import { and, eq, sql } from "drizzle-orm";

import { Tx } from "../common";
import * as SCHEMA from "../schema/index.js";

export const computeDeploymentSelectorResources = async (
  db: Tx,
  deploymentId: string,
) => {
  const deployment = await db.query.deployment.findFirst({
    where: eq(SCHEMA.deployment.id, deploymentId),
    with: { system: true },
  });
  if (deployment == null)
    throw new Error(`Deployment not found: ${deploymentId}`);

  const { system } = deployment;
  const { workspaceId } = system;

  await db
    .delete(SCHEMA.deploymentSelectorComputedResource)
    .where(
      eq(SCHEMA.deploymentSelectorComputedResource.deploymentId, deploymentId),
    );

  if (deployment.resourceSelector == null) return;

  await db
    .insert(SCHEMA.deploymentSelectorComputedResource)
    .select(
      db
        .select({
          deploymentId: sql<string>`${deployment.id}`.as("deploymentId"),
          resourceId: SCHEMA.resource.id,
        })
        .from(SCHEMA.resource)
        .where(
          and(
            eq(SCHEMA.resource.workspaceId, workspaceId),
            SCHEMA.resourceMatchesMetadata(db, deployment.resourceSelector),
          ),
        ),
    )
    .onConflictDoNothing();
};
