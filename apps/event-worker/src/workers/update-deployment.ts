import { and, eq, getResourceSelectorDiff, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

const updateDeploymentSelectorComputedResources = async (
  deploymentId: string,
  unmatchedResourceIds: string[],
  matchedResourceIds: string[],
) => {
  await db
    .delete(SCHEMA.deploymentSelectorComputedResource)
    .where(
      and(
        eq(
          SCHEMA.deploymentSelectorComputedResource.deploymentId,
          deploymentId,
        ),
        inArray(
          SCHEMA.deploymentSelectorComputedResource.resourceId,
          unmatchedResourceIds,
        ),
      ),
    );

  const inserts = matchedResourceIds.map((resourceId) => ({
    deploymentId,
    resourceId,
  }));

  await db
    .insert(SCHEMA.deploymentSelectorComputedResource)
    .values(inserts)
    .onConflictDoNothing();
};

export const updateDeploymentWorker = createWorker(
  Channel.UpdateDeployment,
  async (job) => {
    const { data } = job;
    const { oldSelector, ...deployment } = data;

    const system = await db.query.system.findFirst({
      where: eq(SCHEMA.system.id, deployment.systemId),
    });
    if (system == null)
      throw new Error(`System not found: ${deployment.systemId}`);

    const { workspaceId } = system;

    const { newlyMatchedResources, unmatchedResources, unchangedResources } =
      await getResourceSelectorDiff(
        db,
        workspaceId,
        oldSelector,
        deployment.resourceSelector,
      );

    await updateDeploymentSelectorComputedResources(
      deployment.id,
      unmatchedResources.map((r) => r.id),
      [...newlyMatchedResources, ...unchangedResources].map((r) => r.id),
    );
  },
);
