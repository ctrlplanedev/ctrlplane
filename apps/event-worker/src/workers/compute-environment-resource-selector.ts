import ms from "ms";

import { and, eq, isNull, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { withMutex } from "../utils/with-mutex.js";

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
 * 1. Acquires a mutex lock to prevent concurrent updates to the same
 *    environment
 * 2. Deletes existing computed resource associations
 * 3. Finds all resources matching the environment's selector
 * 4. Inserts new computed resource associations
 * 5. If lock acquisition fails, retries after 1 second
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
    const key = `${Channel.ComputeEnvironmentResourceSelector}:${environment.id}`;
    const [acquired] = await withMutex(key, () => {
      db.transaction(async (tx) => {
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

        await tx
          .insert(schema.computedEnvironmentResource)
          .values(computedEnvironmentResources);
      });
    });

    if (!acquired) {
      await getQueue(Channel.ComputeEnvironmentResourceSelector).add(
        job.name,
        job.data,
        { delay: ms("1s"), jobId: job.id },
      );
      return;
    }

    getQueue(Channel.ComputeSystemsReleaseTargets).add(
      environment.system.id,
      environment.system,
      { delay: ms("1s"), jobId: environment.system.id },
    );
  },
);
