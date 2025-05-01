import _ from "lodash";

import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

const log = logger.child({
  module: "env-selector-update",
  function: "envSelectorUpdateWorker",
});

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
      console.log("updateEnvironmentWorker");
      await getQueue(Channel.ComputeEnvironmentResourceSelector).add(
        job.data.id,
        job.data,
      );
    } catch (error) {
      log.error("Error updating environment", { error });
      throw error;
    }
  },
);
