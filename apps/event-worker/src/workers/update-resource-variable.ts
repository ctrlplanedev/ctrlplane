import _ from "lodash";

import { eq, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

const log = logger.child({ module: "update-resource-variable" });

const dispatchExitHooks = async (
  deployments: schema.Deployment[],
  exitedResource: schema.Resource,
) => {
  const events = deployments.map((deployment) => ({
    action: "deployment.resource.removed" as const,
    payload: { deployment, resource: exitedResource },
  }));

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

const recomputeReleaseTargets = async (resource: schema.Resource) => {
  const computeBuilder = selector().compute();
  await computeBuilder.allResourceSelectors(resource.workspaceId);
  return computeBuilder.resources([resource]).releaseTargets();
};

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
      const resource = await db.query.resource.findFirst({
        where: eq(schema.resource.id, resourceId),
        with: { releaseTargets: { with: { deployment: true } } },
      });
      if (resource == null)
        throw new Error(`Resource not found: ${resourceId}`);
      const currentDeployments = resource.releaseTargets.map(
        (rt) => rt.deployment,
      );

      const rts = await recomputeReleaseTargets(resource);
      await dispatchEvaluateJobs(rts);

      const exitedDeployments = _.chain(currentDeployments)
        .filter((d) => !rts.some((rt) => rt.deploymentId === d.id))
        .uniqBy((d) => d.id)
        .value();
      await dispatchExitHooks(exitedDeployments, resource);
    } catch (error) {
      log.error("Error updating resource variable", { error });
      throw error;
    }
  },
);
