import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchComputeEnvironmentResourceSelectorJobs = async (
  environment: schema.Environment,
) => {
  const { id } = environment;
  const q = getQueue(Channel.ComputeEnvironmentResourceSelector);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, environment);
};
