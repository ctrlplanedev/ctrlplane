import { Channel, createWorker, dispatchQueueJob } from "@ctrlplane/events";

export const newEnvironmentWorker = createWorker(
  Channel.NewEnvironment,
  async (job) => {
    const { data: environment } = job;
    await dispatchQueueJob()
      .toCompute()
      .environment(environment)
      .resourceSelector();
  },
);
