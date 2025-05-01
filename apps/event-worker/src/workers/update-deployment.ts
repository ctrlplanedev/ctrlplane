import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

const log = logger.child({ module: "update-deployment" });

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
      const jobAgentChanged = !_.isEqual(
        data.old.jobAgentId,
        data.new.jobAgentId,
      );
      const jobAgentConfigChanged = !_.isEqual(
        data.old.jobAgentConfig,
        data.new.jobAgentConfig,
      );
      if (jobAgentChanged || jobAgentConfigChanged) {
        const releaseTargets = await db.query.releaseTarget.findMany({
          where: eq(schema.releaseTarget.deploymentId, data.new.id),
        });

        await dispatchEvaluateJobs(releaseTargets);
      }

      if (_.isEqual(data.old.resourceSelector, data.new.resourceSelector))
        return;

      getQueue(Channel.ComputeDeploymentResourceSelector).add(
        data.new.id,
        data.new,
      );
    } catch (error) {
      log.error("Error updating deployment", { error });
      throw error;
    }
  },
);
