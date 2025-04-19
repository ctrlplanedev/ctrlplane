import { selector } from "@ctrlplane/db";
import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

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
    await selector().compute().allResourceSelectors(workspaceId);

    const releaseTargets = await selector()
      .compute()
      .resources([resource])
      .releaseTargets();

    await dispatchEvaluateJobs(releaseTargets);
  },
);
