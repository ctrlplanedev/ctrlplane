import { and, eq, isNull, selector, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

const log = logger.child({ worker: "compute-environment-resource-selector" });

/**
 * Worker that computes and updates the resources associated with an environment
 * based on its resource selector.
 *
 * When an environment's resource selector changes, we need to recompute which
 * resources match the selector and update the computed_environment_resource
 * table accordingly. This ensures that the environment's resource associations
 * stay in sync with the selector criteria.
 *
 * The worker:
 * 1. Acquires a db lock to prevent concurrent updates to the same
 *    environment
 * 2. Deletes existing computed resource associations
 * 3. Finds all resources matching the environment's selector
 * 4. Inserts new computed resource associations
 * 5. If lock acquisition fails, retries after 500ms
 */
export const computeEnvironmentResourceSelectorWorkerEvent = createWorker(
  Channel.ComputeEnvironmentResourceSelector,
  async (job) => {
    const { id } = job.data;

    const environment = await db.query.environment.findFirst({
      where: eq(schema.environment.id, id),
      with: { system: true },
    });

    if (environment == null) throw new Error("Environment not found");

    const { workspaceId } = environment.system;
    try {
      await db.transaction(async (tx) => {
        // acquire a lock on the environment
        await tx.execute(
          sql`
           SELECT * from ${schema.computedEnvironmentResource}
           WHERE ${eq(schema.computedEnvironmentResource.environmentId, environment.id)}
           FOR UPDATE NOWAIT
          `,
        );

        await tx
          .delete(schema.computedEnvironmentResource)
          .where(
            eq(
              schema.computedEnvironmentResource.environmentId,
              environment.id,
            ),
          );

        if (environment.resourceSelector == null) return;

        const resources = await tx.query.resource.findMany({
          where: and(
            eq(schema.resource.workspaceId, workspaceId),
            selector()
              .query()
              .resources()
              .where(environment.resourceSelector)
              .sql(),
            isNull(schema.resource.deletedAt),
          ),
        });

        const computedEnvironmentResources = resources.map((r) => ({
          environmentId: environment.id,
          resourceId: r.id,
        }));

        if (computedEnvironmentResources.length === 0) return;
        await tx
          .insert(schema.computedEnvironmentResource)
          .values(computedEnvironmentResources)
          .onConflictDoNothing();
      });

      await getQueue(Channel.ComputeSystemsReleaseTargets).add(
        environment.system.id,
        environment.system,
      );
    } catch (e: any) {
      const isRowLocked = e.code === "55P03";
      if (isRowLocked) {
        log.info(
          "Row locked in compute-environment-resource-selector, requeueing...",
          { job },
        );
        await getQueue(Channel.ComputeEnvironmentResourceSelector).add(
          job.name,
          job.data,
        );
        return;
      }

      throw e;
    }
  },
);
