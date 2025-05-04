import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchComputeDeploymentResourceSelectorJobs } from "../utils/dispatch-compute-deployment-jobs.js";

export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async (job) => {
    const { data: deployment } = job;
    await dispatchComputeDeploymentResourceSelectorJobs(deployment);
  },
);
