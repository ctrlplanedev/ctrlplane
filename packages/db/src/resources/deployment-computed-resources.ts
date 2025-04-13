import { and, eq, sql } from "drizzle-orm";

import { takeFirst, Tx } from "../common";
import * as SCHEMA from "../schema/index.js";

export const computeDeploymentSelectorResources = async (
  db: Tx,
  deployment: Pick<SCHEMA.Deployment, "id" | "resourceSelector">,
) => {
  const { workspaceId } = await db
    .select({
      workspaceId: SCHEMA.system.workspaceId,
    })
    .from(SCHEMA.deployment)
    .innerJoin(SCHEMA.system, eq(SCHEMA.deployment.systemId, SCHEMA.system.id))
    .where(eq(SCHEMA.deployment.id, deployment.id))
    .then(takeFirst);

  await db
    .delete(SCHEMA.deploymentSelectorComputedResource)
    .where(
      eq(SCHEMA.deploymentSelectorComputedResource.deploymentId, deployment.id),
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
