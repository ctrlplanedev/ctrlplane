import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchComputeDeploymentResourceSelectorJobs } from "../utils/dispatch-compute-deployment-jobs.js";
import { dispatchComputeEnvironmentResourceSelectorJobs } from "../utils/dispatch-compute-env-jobs.js";

/**
 * Worker that processes new resource events.
 *
 * When a new resource is created, perform the following steps:
 * 1. Recompute all environments' and deployments' resource selectors
 * 2. Upsert release targets for the resource
 * 3. Recompute all policy targets' computed release targets
 * 4. Add all upserted release targets to the evaluation queue
 *
 * @param {Job<ChannelMap[Channel.NewResource]>} job - The resource data
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export const newResourceWorker = createWorker(
  Channel.NewResource,
  async ({ data: resource }) => {
    const { workspaceId } = resource;

    const systems = await db.query.system.findMany({
      where: eq(schema.system.workspaceId, workspaceId),
      with: { environments: true, deployments: true },
    });
    const environments = systems.flatMap((s) => s.environments);

    for (const environment of environments) {
      await dispatchComputeEnvironmentResourceSelectorJobs(environment);
    }

    const deployments = systems.flatMap((s) => s.deployments);
    for (const deployment of deployments) {
      await dispatchComputeDeploymentResourceSelectorJobs(deployment);
    }
  },
);
