import { Channel, createWorker } from "@ctrlplane/events";

import { dispatchComputeEnvironmentResourceSelectorJobs } from "../utils/dispatch-compute-env-jobs.js";

export const newEnvironmentWorker = createWorker(
  Channel.NewEnvironment,
  async (job) => {
    const { data: environment } = job;
    console.log("newEnvironmentWorker");
    await dispatchComputeEnvironmentResourceSelectorJobs(environment);
  },
);
