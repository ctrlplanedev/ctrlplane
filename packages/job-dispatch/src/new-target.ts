import type { Tx } from "@ctrlplane/db";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingLockingPolicy } from "./lock-checker.js";
import { isPassingApprovalPolicy } from "./policies/manual-approval.js";
import { isPassingReleaseDependencyPolicy } from "./policies/release-dependency.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";

/**
 * Dispatches jobs for new targets added to an environment.
 */
export async function dispatchJobsForNewTargets(
  db: Tx,
  newTargetIds: string[],
  envId: string,
): Promise<void> {
  const releaseJobTriggers = await createReleaseJobTriggers(db, "new_target")
    .targets(newTargetIds)
    .environments([envId])
    .insert();
  if (releaseJobTriggers.length === 0) return;

  await dispatchReleaseJobTriggers(db)
    .filter(
      isPassingLockingPolicy,
      isPassingApprovalPolicy,
      isPassingReleaseDependencyPolicy,
    )
    .releaseTriggers(releaseJobTriggers)
    .dispatch();
}
