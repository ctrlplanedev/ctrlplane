import type { Tx } from "@ctrlplane/db";
import type { ReleaseJobTrigger } from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, notInArray } from "@ctrlplane/db";
import {
  environment,
  environmentPolicy,
  job,
  release,
  releaseJobTrigger,
} from "@ctrlplane/db/schema";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns A Promise that resolves when the release job triggers are cancelled. release job triggers are cancelled
 * if there is a policy on the environment specifying that old release job triggers should be cancelled
 * upon a new job config being dispatched. It "cancels" the release job triggers by creating a job
 * with the status "cancelled".
 */
export const cancelOldReleaseJobTriggersOnJobDispatch = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return;
  const environmentPolicyShouldCanncel = eq(
    environmentPolicy.releaseSequencing,
    "cancel",
  );
  const isAffectedEnvironment = inArray(
    environment.id,
    releaseJobTriggers.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDispatchedReleaseJobTrigger = notInArray(
    releaseJobTrigger.id,
    releaseJobTriggers.map((t) => t.id),
  );
  const isNotDeleted = isNull(environment.deletedAt);
  const isNotSameRelease = notInArray(
    release.id,
    releaseJobTriggers.map((t) => t.releaseId).filter(isPresent),
  );

  const oldReleaseJobTriggersToCancel = await db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(job, eq(job.id, releaseJobTrigger.jobId))
    .innerJoin(environment, eq(environment.id, releaseJobTrigger.environmentId))
    .innerJoin(release, eq(release.id, releaseJobTrigger.releaseId))
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
    )
    .where(
      and(
        environmentPolicyShouldCanncel,
        isAffectedEnvironment,
        isNotDispatchedReleaseJobTrigger,
        isNotDeleted,
        isNotSameRelease,
      ),
    )
    .then((r) => r.map((t) => t.job.id));
  if (oldReleaseJobTriggersToCancel.length === 0) return;

  await db
    .update(job)
    .set({ status: "cancelled" })
    .where(inArray(job.id, oldReleaseJobTriggersToCancel));
};
