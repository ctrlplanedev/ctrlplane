import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async (job) => {
    const { data: deployment } = job;
    await dispatchQueueJob()
      .toCompute()
      .deployment(deployment)
      .resourceSelector();
  },
);
