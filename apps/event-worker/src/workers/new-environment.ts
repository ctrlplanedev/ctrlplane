import { Channel, createWorker, getQueue } from "@ctrlplane/events";

export const newEnvironmentWorker = createWorker(
  Channel.NewEnvironment,
  async (job) => {
    const { data: environment } = job;
    console.log("newEnvironmentWorker");
    await getQueue(Channel.ComputeEnvironmentResourceSelector).add(
      environment.id,
      environment,
    );
  },
);
