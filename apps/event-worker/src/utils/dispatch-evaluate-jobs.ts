import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";

import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchEvaluateJobs = async (rts: ReleaseTargetIdentifier[]) => {
  const jobs = rts.map((rt) => ({
    name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
    data: rt,
  }));
  await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
};
