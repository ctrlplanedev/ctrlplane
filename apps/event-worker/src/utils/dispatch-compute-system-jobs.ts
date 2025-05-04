import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchComputeSystemReleaseTargetsJobs = async (
  system: schema.System,
) => {
  const { id } = system;
  const q = getQueue(Channel.ComputeSystemsReleaseTargets);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, system);
};
