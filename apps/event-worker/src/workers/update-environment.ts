import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { and, eq, not, selector } from "@ctrlplane/db";
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
      const { oldSelector, resourceSelector } = job.data;
      if (_.isEqual(oldSelector, resourceSelector)) return;

      getQueue(Channel.ComputeEnvironmentResourceSelector).add(
        job.data.id,
        job.data,
        { jobId: job.data.id },
      );

      const exitedResources = await db.query.resource.findMany({
        where: and(
          selector().query().resources().where(oldSelector).sql(),
          not(selector().query().resources().where(resourceSelector).sql()!),
        ),
      });

      await dispatchExitHooks(db, job.data.id, exitedResources);
    } catch (error) {
      log.error("Error updating environment", { error });
      throw error;
    }
  },
);
