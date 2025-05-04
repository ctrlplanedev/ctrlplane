import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchComputeDeploymentResourceSelectorJobs = async (
  deployment: schema.Deployment,
) => {
  const { id } = deployment;
  const q = getQueue(Channel.ComputeDeploymentResourceSelector);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, deployment);
};
