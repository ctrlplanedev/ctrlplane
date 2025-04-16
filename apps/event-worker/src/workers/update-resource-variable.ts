import { eq, selector, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { replaceReleaseTargets } from "../utils/replace-release-targets.js";

const log = logger.child({ module: "update-resource-variable" });

/**
 * Worker that updates a resource variable
 *
 * When a resource variable is updated, perform the following steps:
 * 1. Recompute all environments' and deployments' resource selectors
 * 2. Replace the release targets for the resource based on new computations
 * 3. Recompute all policy targets' computed release targets based on the new release targets
 * 4. Add all replaced release targets to the evaluation queue
 *
 * @param {Job<ChannelMap[Channel.UpdateResourceVariable]>} job - The resource variable data
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export const updateResourceVariableWorker = createWorker(
  Channel.UpdateResourceVariable,
  async (job) => {
    try {
      const { data } = job;
      const { resourceId } = data;

      const resource = await db
        .select()
        .from(schema.resource)
        .where(eq(schema.resource.id, resourceId))
        .then(takeFirst);
      const { workspaceId } = resource;

      const cb = selector().compute();

      await Promise.all([
        cb.allEnvironments(workspaceId).resourceSelectors().replace(),
        cb.allDeployments(workspaceId).resourceSelectors().replace(),
      ]);
      const rts = await replaceReleaseTargets(db, resource);
      await cb.allPolicies(workspaceId).releaseTargetSelectors().replace();
      const jobs = rts.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
    } catch (error) {
      log.error("Error updating resource variable", { error });
      throw error;
    }
  },
);
