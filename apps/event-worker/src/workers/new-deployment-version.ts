import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  Channel,
  createWorker,
  dispatchEvaluateReleaseTargetJobs,
} from "@ctrlplane/events";

/**
 * Worker that processes new deployment version events.
 * When a new deployment version is created, simply grab all release targets for the deployment
 * and add them to the evaluation queue.
 *
 * @param {Job<ChannelMap[Channel.NewDeploymentVersion]>} job - The deployment version data
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */

export const newDeploymentVersionWorker = createWorker(
  Channel.NewDeploymentVersion,
  async ({ data: version }) => {
    const releaseTargets = await db.query.releaseTarget.findMany({
      where: eq(schema.releaseTarget.deploymentId, version.deploymentId),
    });
    await dispatchEvaluateReleaseTargetJobs(releaseTargets);
  },
);
