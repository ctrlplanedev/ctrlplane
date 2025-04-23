import type * as schema from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, not, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

const log = logger.child({ module: "update-deployment" });

const dispatchExitHooks = async (
  deployment: schema.Deployment,
  exitedResources: schema.Resource[],
) => {
  const events = exitedResources.map((resource) => ({
    action: "deployment.resource.removed" as const,
    payload: { deployment, resource },
  }));

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

/**
 * Worker that does the post-processing after a deployment is updated
 * 1. Grab the current release targets for the deployment, with resources
 * 2. For the current resources, recompute the release targets
 *
 * @param {Job<ChannelMap[Channel.UpdateDeployment]>} job - The deployment data
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export const updateDeploymentWorker = createWorker(
  Channel.UpdateDeployment,
  async ({ data }) => {
    try {
      const { oldSelector, resourceSelector } = data;
      if (_.isEqual(oldSelector, resourceSelector)) return;

      getQueue(Channel.ComputeDeploymentResourceSelector).add(data.id, data, {
        jobId: data.id,
      });

      const exitedResources = await db.query.resource.findMany({
        where: and(
          selector().query().resources().where(oldSelector).sql(),
          not(selector().query().resources().where(resourceSelector).sql()!),
        ),
      });

      await dispatchExitHooks(data, exitedResources);
    } catch (error) {
      log.error("Error updating deployment", { error });
      throw error;
    }
  },
);
