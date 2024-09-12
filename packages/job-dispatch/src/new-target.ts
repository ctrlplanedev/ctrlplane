import type { Tx } from "@ctrlplane/db";

import { and, arrayContains, eq, inArray } from "@ctrlplane/db";
import { environment, target } from "@ctrlplane/db/schema";

import { createJobConfigs } from "./job-config.js";
import { dispatchJobConfigs } from "./job-dispatch.js";
import { isPassingLockingPolicy } from "./lock-checker.js";
import { isPassingApprovalPolicy } from "./policy-checker.js";
import { isPassingReleaseDependencyPolicy } from "./release-checker.js";

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

  const jobConfigs = await createJobConfigs(db, "new_target")
    .targets(newTargetIds)
    .environments([envId])
    .insert();

  const dispatched = await dispatchJobConfigs(db)
    .reason("env_policy_override")
    .filter(
      isPassingLockingPolicy,
      isPassingApprovalPolicy,
      isPassingReleaseDependencyPolicy,
    )
    .jobConfigs(jobConfigs)
    .dispatch();

  const notDispatchedConfigs = jobConfigs.filter(
    (config) =>
      !dispatched.some((dispatch) => dispatch.jobConfigId === config.id),
  );
  console.log(
    `${notDispatchedConfigs.length} out of ${jobConfigs.length} job configs were not dispatched.`,
  );
}
