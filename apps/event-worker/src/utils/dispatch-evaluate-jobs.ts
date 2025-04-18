import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";

export const dispatchEvaluateJobs = async (rts: schema.ReleaseTarget[]) => {
  const jobs = rts.map((rt) => ({
    name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
    data: rt,
  }));
  await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
};
