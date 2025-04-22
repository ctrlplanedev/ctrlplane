import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

const log = logger.child({ module: "new-deployment" });

const recomputeReleaseTargets = async (
  deployment: schema.Deployment,
  resources: schema.Resource[],
) => {
  const computeBuilder = selector().compute();
  await computeBuilder.deployments([deployment]).resourceSelectors();
  return computeBuilder.resources(resources).releaseTargets();
};

/**
 * Worker that processes new deployment events.
 *
 * When a new deployment is created, perform the following steps:
 * 1. Compute the deployment's resources based on its selector
 * 2. Upsert release targets for the newly computed resources
 * 3. Recompute all policy targets' computed release targets
 * 4. Add all upserted release targets to the evaluation queue
 *
 * @param {Job<ChannelMap[Channel.NewDeployment]>} job - The deployment data
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async (job) => {
    try {
      const environments = await db.query.environment.findMany({
        where: eq(schema.environment.systemId, job.data.systemId),
        with: { computedResources: { with: { resource: true } } },
      });

      const resources = environments.flatMap((e) =>
        e.computedResources.map((r) => r.resource),
      );

      const releaseTargets = await recomputeReleaseTargets(job.data, resources);
      await dispatchEvaluateJobs(releaseTargets);
    } catch (error) {
      console.error(error);
      log.error("Error upserting release targets", { error });
      throw error;
    }
  },
);
