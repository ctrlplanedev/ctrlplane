import { selector } from "@ctrlplane/db";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

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
    const computeBuilder = selector().compute();
    const { workspaceId } = resource;
    await computeBuilder.allResourceSelectors(workspaceId);
    const releaseTargets = await computeBuilder
      .resources([resource])
      .releaseTargets();
    const jobs = releaseTargets.map((rt) => ({
      name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      data: rt,
    }));
    await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
  },
);
