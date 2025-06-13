import { and, eq, isNull, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

export const computeDeploymentResourceSelectorWorkerEvent = createWorker(
  Channel.ComputeDeploymentResourceSelector,
  async (job) => {
    const { id } = job.data;

    const deployment = await db.query.deployment.findFirst({
      where: eq(schema.deployment.id, id),
      with: { system: true },
    });

    if (deployment == null) throw new Error("Deployment not found");

    const { workspaceId } = deployment.system;
    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`
           SELECT * from ${schema.computedDeploymentResource}
           WHERE ${eq(schema.computedDeploymentResource.deploymentId, deployment.id)}
           FOR UPDATE NOWAIT
          `,
        );

        await tx
          .delete(schema.computedDeploymentResource)
          .where(
            eq(schema.computedDeploymentResource.deploymentId, deployment.id),
          );

        if (deployment.resourceSelector == null) return;

        const resources = await tx.query.resource.findMany({
          where: and(
            eq(schema.resource.workspaceId, workspaceId),
            selector()
              .query()
              .resources()
              .where(deployment.resourceSelector)
              .sql(),
            isNull(schema.resource.deletedAt),
          ),
        });

        const computedDeploymentResources = resources.map((r) => ({
          deploymentId: deployment.id,
          resourceId: r.id,
        }));

        if (computedDeploymentResources.length > 0)
          await tx
            .insert(schema.computedDeploymentResource)
            .values(computedDeploymentResources)
            .onConflictDoNothing();
      });

      dispatchQueueJob().toCompute().system(deployment.system).releaseTargets();
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        dispatchQueueJob()
          .toCompute()
          .deployment(deployment)
          .resourceSelector();
        return;
      }

      throw e;
    }
  },
);
