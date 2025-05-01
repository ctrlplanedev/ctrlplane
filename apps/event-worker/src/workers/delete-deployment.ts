import { eq, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

export const deleteDeploymentWorker = createWorker(
  Channel.DeleteDeployment,
  async (job) => {
    const { id: deploymentId } = job.data;

    try {
      const releaseTargets = await db.transaction(async (tx) => {
        await tx.execute(
          sql`
            SELECT * from ${schema.deployment}
            INNER JOIN ${schema.releaseTarget} ON ${eq(schema.releaseTarget.deploymentId, schema.deployment.id)}
            WHERE ${eq(schema.deployment.id, deploymentId)}
            FOR UPDATE NOWAIT
          `,
        );

        const releaseTargets = await tx.query.releaseTarget.findMany({
          where: eq(schema.releaseTarget.deploymentId, deploymentId),
        });

        await tx
          .delete(schema.deployment)
          .where(eq(schema.deployment.id, deploymentId));

        return releaseTargets;
      });

      for (const rt of releaseTargets)
        getQueue(Channel.DeletedReleaseTarget).add(rt.id, rt, {
          deduplication: { id: rt.id },
        });
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        await getQueue(Channel.DeleteDeployment).add(job.name, job.data);
        return;
      }

      throw e;
    }
  },
);
