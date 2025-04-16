import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

const log = logger.child({
  module: "env-selector-update",
  function: "envSelectorUpdateWorker",
});

const dispatchExitHooks = async (
  db: Tx,
  systemId: string,
  exitedResources: schema.Resource[],
) => {
  const deployments = await db
    .select()
    .from(schema.deployment)
    .where(eq(schema.deployment.systemId, systemId));

  const events = exitedResources.flatMap((resource) =>
    deployments.map((deployment) => ({
      action: "deployment.resource.removed" as const,
      payload: { deployment, resource },
    })),
  );

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

/**
 * Worker that handles environment updates.
 *
 * When an environment is updated and the resource selector is changed, perform the following steps:
 * 1. Recompute the resources for the environment and return which resources
 *    have been added and which have been removed
 * 2. For all affected resources, replace the release targets based on new computations
 * 3. Recompute all policy targets' computed release targets based on the new release targets
 * 4. Add all replaced release targets to the evaluation queue
 * 5. Dispatch exit hooks for the exited resources
 *
 * @param {Job<ChannelMap[Channel.UpdateEnvironment]>} job - The job containing environment data with old and new selectors
 * @returns {Promise<void>} - Resolves when processing is complete
 * @throws {Error} - If there's an issue with database operations
 */
export const updateEnvironmentWorker = createWorker(
  Channel.UpdateEnvironment,
  async (job) => {
    try {
      const { oldSelector, ...environment } = job.data;
      if (_.isEqual(oldSelector, environment.resourceSelector)) return;

      const currentReleaseTargets = await db.query.releaseTarget.findMany({
        where: eq(schema.releaseTarget.environmentId, environment.id),
        with: { resource: true },
      });
      const currentResources = currentReleaseTargets.map((rt) => rt.resource);

      const rts = await selector()
        .compute()
        .resources(currentResources.map((r) => r.id))
        .releaseTargets()
        .replace();

      const evaluateJobs = rts.map((rt) => ({ name: rt.id, data: rt }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(evaluateJobs);

      const exitedResources = currentResources.filter(
        (r) =>
          !rts.some(
            (rt) =>
              rt.resourceId === r.id && rt.environmentId === environment.id,
          ),
      );
      await dispatchExitHooks(db, environment.systemId, exitedResources);
    } catch (error) {
      log.error("Error updating environment", { error });
      throw error;
    }
  },
);
