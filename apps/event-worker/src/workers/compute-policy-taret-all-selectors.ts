import { Channel, createWorker, getQueue } from "@ctrlplane/events";

export const computePolicyTargetAllSelectorsWorker = createWorker(
  Channel.ComputePolicyTargetAllSelectors,
  async (job) => {
    const { id } = job.data;

    await Promise.all([
      getQueue(Channel.ComputePolicyTargetEnvironmentSelector).add(id, {
        id,
      }),
      getQueue(Channel.ComputePolicyTargetDeploymentSelector).add(id, {
        id,
      }),
      getQueue(Channel.ComputePolicyTargetReleaseTargetSelector).add(id, {
        id,
      }),
    ]);
  },
);
