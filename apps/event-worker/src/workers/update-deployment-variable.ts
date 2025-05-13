import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchEvaluateJobs } from "../utils/dispatch-evaluate-jobs.js";

/**
 * Worker that handles deployment variable changes
 *
 * When a deployment variable is updated, perform the following steps:
 * 1. Grab all release targe†s associated with the deployment
 * 2. Add them to the evaluation queue
 *
 * @param {Job<ChannelMap[Channel.UpdateDeploymentVariable]>} job - The deployment variable data
 * @returns {Promise<void>} A promise that resolves when processing is complete
 */
export const updateDeploymentVariableWorker = createWorker(
  Channel.UpdateDeploymentVariable,
  async (job) => {
    const variable = await db.query.deploymentVariable.findFirst({
      where: eq(schema.deploymentVariable.id, job.data.id),
    });

    if (variable == null) throw new Error("Deployment variable not found");

    const releaseTargets = await db.query.releaseTarget.findMany({
      where: eq(schema.releaseTarget.deploymentId, variable.deploymentId),
    });

    await dispatchEvaluateJobs(releaseTargets);
  },
);
