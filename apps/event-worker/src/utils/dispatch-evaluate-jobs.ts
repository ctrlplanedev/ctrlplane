import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";

import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchEvaluateJobs = async (rts: ReleaseTargetIdentifier[]) => {
  const q = getQueue(Channel.EvaluateReleaseTarget);
  const waiting = await q.getWaiting();
  const rtsToEvaluate = rts.filter(
    (rt) =>
      !waiting.some(
        (job) =>
          job.data.deploymentId === rt.deploymentId &&
          job.data.environmentId === rt.environmentId &&
          job.data.resourceId === rt.resourceId,
      ),
  );

  for (const rt of rtsToEvaluate)
    await q.add(`${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`, rt);
};
