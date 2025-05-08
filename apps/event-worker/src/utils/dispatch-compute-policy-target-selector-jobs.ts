import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchComputePolicyTargetReleaseTargetSelectorJobs = async (
  policyTarget: schema.PolicyTarget,
) => {
  const { id } = policyTarget;
  const q = getQueue(Channel.ComputePolicyTargetReleaseTargetSelector);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === id);
  if (isAlreadyQueued) return;
  await q.add(id, policyTarget);
};
