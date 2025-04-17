import _ from "lodash";

import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
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

      const currentReleaseTargets = await db.query.releaseTarget.findMany({
        where: eq(schema.releaseTarget.deploymentId, data.id),
        with: { resource: true },
      });
      const currentResources = currentReleaseTargets.map((rt) => rt.resource);
      const computeBuilder = selector().compute();
      await computeBuilder.deployments([data]).resourceSelectors();
      const rts = await computeBuilder
        .resources(currentResources)
        .releaseTargets();
      const exitedResources = currentResources.filter(
        (r) =>
          !rts.some(
            (rt) => rt.resourceId === r.id && rt.deploymentId === data.id,
          ),
      );

      const evaluateJobs = rts.map((rt) => ({ name: rt.id, data: rt }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(evaluateJobs);

      await dispatchExitHooks(data, exitedResources);
    } catch (error) {
      log.error("Error updating deployment", { error });
      throw error;
    }
  },
);
