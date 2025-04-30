import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import type { BulkJobOptions } from "bullmq";

import { Channel, getQueue } from "./index.js";

export const dispatchEvaluateReleaseTargetJobs = async (
  rts: ReleaseTargetIdentifier[],
  opts: BulkJobOptions & { skipDuplicateCheck?: boolean } = {},
) => {
  const jobs = rts.map((rt) => ({
    name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
    data: { ...rt, skipDuplicateCheck: opts.skipDuplicateCheck },
    opts,
  }));
  await getQueue(Channel.EvaluateReleaseTarget).addBulk(jobs);
};
