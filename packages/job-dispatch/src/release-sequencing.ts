import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, notInArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

const exitStatus: schema.JobStatus[] = [
  "completed",
  "failure",
  "cancelled",
  "skipped",
];

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
  releaseJobTriggers: schema.ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return;
  const environmentPolicyShouldCanncel = eq(
    schema.environmentPolicy.releaseSequencing,
    "cancel",
  );
  const isAffectedEnvironment = inArray(
    schema.environment.id,
    releaseJobTriggers.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDispatchedReleaseJobTrigger = notInArray(
    schema.releaseJobTrigger.id,
    releaseJobTriggers.map((t) => t.id),
  );
  const isNotDeleted = isNull(schema.environment.deletedAt);
  const isNotSameRelease = notInArray(
    schema.release.id,
    releaseJobTriggers.map((t) => t.releaseId).filter(isPresent),
  );
  const isNotAlreadyCompleted = notInArray(schema.job.status, exitStatus);

  const oldReleaseJobTriggersToCancel = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(schema.job, eq(schema.job.id, schema.releaseJobTrigger.jobId))
    .innerJoin(
      schema.environment,
      eq(schema.environment.id, schema.releaseJobTrigger.environmentId),
    )
    .innerJoin(
      schema.release,
      eq(schema.release.id, schema.releaseJobTrigger.releaseId),
    )
    .innerJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .where(
      and(
        environmentPolicyShouldCanncel,
        isAffectedEnvironment,
        isNotDispatchedReleaseJobTrigger,
        isNotDeleted,
        isNotSameRelease,
        isNotAlreadyCompleted,
      ),
    )
    .then((r) => r.map((t) => t.job.id));
  if (oldReleaseJobTriggersToCancel.length === 0) return;

  await db
    .update(schema.job)
    .set({ status: "cancelled" })
    .where(inArray(schema.job.id, oldReleaseJobTriggersToCancel));
};
