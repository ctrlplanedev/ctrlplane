import type { Tx } from "@ctrlplane/db";

import { and, arrayContains, eq, inArray } from "@ctrlplane/db";
import { environment, target } from "@ctrlplane/db/schema";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingLockingPolicy } from "./lock-checker.js";
import { isPassingApprovalPolicy } from "./policies/manual-approval.js";
import { isPassingReleaseDependencyPolicy } from "./policies/release-dependency.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";

/**
 * Asserts that all given targets are part of the specified environment.
 *
 * This is a runtime assertion to make it easier to debug if this ever happens.
 * It ensures that the targets being processed are actually associated with the
 * given environment.
 */
async function assertTargetsInEnvironment(
  db: Tx,
  targetIds: string[],
  envId: string,
): Promise<void> {
  const targetsInEnv = await db
    .select({ id: target.id })
    .from(environment)
    .innerJoin(target, arrayContains(target.labels, environment.targetFilter))
    .where(and(eq(environment.id, envId), inArray(target.id, targetIds)));
  const targetsInEnvIds = new Set(targetsInEnv.map((t) => t.id));
  const allTargetsInEnv = targetIds.every((id) => targetsInEnvIds.has(id));
  if (allTargetsInEnv) return;
  throw new Error("Some targets are not part of the specified environment");
}

/**
 * Dispatches jobs for new targets added to an environment.
 */
export async function dispatchJobsForNewTargets(
  db: Tx,
  newTargetIds: string[],
  envId: string,
): Promise<void> {
  await assertTargetsInEnvironment(db, newTargetIds, envId);

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
