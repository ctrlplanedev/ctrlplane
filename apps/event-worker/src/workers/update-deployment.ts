import _ from "lodash";

import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

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

const recomputeReleaseTargets = async (
  deployment: schema.Deployment & { system: schema.System },
) => {
  const computeBuilder = selector().compute();
  await computeBuilder.deployments([deployment]).resourceSelectors();
  const { system } = deployment;
  const { workspaceId } = system;
  return computeBuilder.allResources(workspaceId).releaseTargets();
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

      const deployment = await db.query.deployment.findFirst({
        where: eq(schema.deployment.id, data.id),
        with: { system: true, releaseTargets: { with: { resource: true } } },
      });
      if (deployment == null)
        throw new Error(`Deployment not found: ${data.id}`);

      const { releaseTargets } = deployment;
      const currentResources = releaseTargets.map((rt) => rt.resource);

      const rts = await recomputeReleaseTargets(deployment);
      await dispatchEvaluateJobs(rts);

      const exitedResources = _.chain(currentResources)
        .filter(
          (r) =>
            !rts.some(
              (rt) => rt.resourceId === r.id && rt.deploymentId === data.id,
            ),
        )
        .uniqBy((r) => r.id)
        .value();
      await dispatchExitHooks(data, exitedResources);
    } catch (error) {
      log.error("Error updating deployment", { error });
      throw error;
    }
  },
);
