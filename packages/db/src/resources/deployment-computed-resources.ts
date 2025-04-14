import { and, eq, isNotNull } from "drizzle-orm";

import { takeFirst, Tx } from "../common";
import * as SCHEMA from "../schema/index.js";

export const computeDeploymentSelectorResources = async (
  db: Tx,
  deployment: Pick<SCHEMA.Deployment, "id" | "resourceSelector">,
) =>
  db.transaction(async (db) => {
    const { workspaceId } = await db
      .select({ workspaceId: SCHEMA.system.workspaceId })
      .from(SCHEMA.deployment)
      .innerJoin(
        SCHEMA.system,
        eq(SCHEMA.deployment.systemId, SCHEMA.system.id),
      )
      .where(eq(SCHEMA.deployment.id, deployment.id))
      .then(takeFirst);

    await db
      .delete(SCHEMA.deploymentSelectorComputedResource)
      .where(
        eq(
          SCHEMA.deploymentSelectorComputedResource.deploymentId,
          deployment.id,
        ),
      );

    if (deployment.resourceSelector == null) return;

    const resourceIds = await db
      .select({ resourceId: SCHEMA.resource.id })
      .from(SCHEMA.resource)
      .where(
        and(
          eq(SCHEMA.resource.workspaceId, workspaceId),
          SCHEMA.resourceMatchesMetadata(db, deployment.resourceSelector),
        ),
      );

    const inserts = resourceIds.map((r) => ({
      deploymentId: deployment.id,
      resourceId: r.resourceId,
    }));
    if (inserts.length === 0) return;

    await db
      .insert(SCHEMA.deploymentSelectorComputedResource)
      .values(inserts)
      .onConflictDoNothing();
  });

export const recomputeAllDeploysInWorkspace = async (
  db: Tx,
  workspaceId: string,
) => {
  const workspace = await db.query.workspace.findFirst({
    where: eq(SCHEMA.workspace.id, workspaceId),
    with: {
      systems: {
        with: {
          deployments: {
            where: isNotNull(SCHEMA.deployment.resourceSelector),
          },
        },
      },
    },
  });
  if (workspace == null) throw new Error(`Workspace not found: ${workspaceId}`);

  const deployments = workspace.systems.flatMap((s) => s.deployments);
  await Promise.all(
    deployments.map((d) => computeDeploymentSelectorResources(db, d)),
  );
};
