import { eq, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

export const deleteEnvironmentWorker = createWorker(
  Channel.DeleteEnvironment,
  async (job) => {
    const { id: environmentId } = job.data;

    try {
      const releaseTargets = await db.transaction(async (tx) => {
        await tx.execute(
          sql`
            SELECT * from ${schema.environment}
            INNER JOIN ${schema.releaseTarget} ON ${eq(schema.releaseTarget.environmentId, schema.environment.id)}
            WHERE ${eq(schema.environment.id, environmentId)}
            FOR UPDATE NOWAIT
          `,
        );

        const releaseTargets = await tx.query.releaseTarget.findMany({
          where: eq(schema.releaseTarget.environmentId, environmentId),
        });

        await tx
          .delete(schema.environment)
          .where(eq(schema.environment.id, environmentId));

        return releaseTargets;
      });

      for (const rt of releaseTargets)
        getQueue(Channel.DeletedReleaseTarget).add(rt.id, rt, {
          deduplication: { id: rt.id },
        });
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        await getQueue(Channel.DeleteEnvironment).add(job.name, job.data);
        return;
      }

      throw e;
    }
  },
);
