import { Channel, createWorker, getQueue } from "@ctrlplane/events";

export const newDeploymentWorker = createWorker(
  Channel.NewDeployment,
  async (job) => {
    await getQueue(Channel.ComputeDeploymentResourceSelector).add(
      job.data.id,
      job.data,
      { deduplication: { id: job.data.id, ttl: 500 } },
    );
  },
);
