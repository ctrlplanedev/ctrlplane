import { eq, selector, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { replaceReleaseTargets } from "../utils/replace-release-targets.js";

const log = logger.child({ module: "new-deployment" });

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
      await selector()
        .compute()
        .deployments([job.data.id])
        .resourceSelectors()
        .replace();

      const system = await db
        .select()
        .from(schema.system)
        .where(eq(schema.system.id, job.data.systemId))
        .then(takeFirst);
      const { workspaceId } = system;

      const computedDeploymentResources = await db
        .select()
        .from(schema.computedDeploymentResource)
        .innerJoin(
          schema.resource,
          eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
        )
        .where(eq(schema.computedDeploymentResource.deploymentId, job.data.id));
      const resources = computedDeploymentResources.map((r) => r.resource);

      const releaseTargetPromises = resources.map(async (r) =>
        replaceReleaseTargets(db, r),
      );
      const fulfilled = await Promise.all(releaseTargetPromises);
      const rts = fulfilled.flat();

      await selector()
        .compute()
        .allPolicies(workspaceId)
        .releaseTargetSelectors()
        .replace();

      const evaluateJobs = rts.map((rt) => ({ name: rt.id, data: rt }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(evaluateJobs);
    } catch (error) {
      log.error("Error upserting release targets", { error });
      throw error;
    }
  },
);
