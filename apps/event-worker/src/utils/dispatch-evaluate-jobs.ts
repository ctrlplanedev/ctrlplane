import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";

import {
  Channel,
  getQueue,
  queueEvaluateReleaseTarget,
} from "@ctrlplane/events";

export const dispatchEvaluateJobs = async (rts: ReleaseTargetIdentifier[]) => {
  for (const rt of rts) {
    await queueEvaluateReleaseTarget(rt);
  }
};
