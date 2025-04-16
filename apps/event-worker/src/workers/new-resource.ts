import { selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { replaceReleaseTargets } from "../utils/replace-release-targets.js";

const queue = getQueue(Channel.EvaluateReleaseTarget);

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
    const cb = selector().compute();

    await Promise.all([
      cb.allEnvironments(resource.workspaceId).resourceSelectors().replace(),
      cb.allDeployments(resource.workspaceId).resourceSelectors().replace(),
    ]);

    const rts = await replaceReleaseTargets(db, resource);
    await cb
      .allPolicies(resource.workspaceId)
      .releaseTargetSelectors()
      .replace();

    const jobs = rts.map((rt) => ({
      name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      data: rt,
    }));
    await queue.addBulk(jobs);
  },
);
