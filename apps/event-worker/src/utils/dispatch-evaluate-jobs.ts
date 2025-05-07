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

  const jobs = rtsToEvaluate.map((rt) => ({
    name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
    data: rt,
  }));
  await q.addBulk(jobs);
};
