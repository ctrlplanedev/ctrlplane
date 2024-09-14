import type { Tx } from "@ctrlplane/db";
import type { JobConfig } from "@ctrlplane/db/schema";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, notInArray } from "@ctrlplane/db";
import {
  environment,
  environmentPolicy,
  job,
  release,
  releaseJobTrigger,
} from "@ctrlplane/db/schema";

import { createJobExecutions } from "./job-execution.js";

/**
 *
 * @param db
 * @param jobConfigs
 * @returns A Promise that resolves when the job configs are cancelled. Job configs are cancelled
 * if there is a policy on the environment specifying that old job configs should be cancelled
 * upon a new job config being dispatched. It "cancels" the job configs by creating a job execution
 * with the status "cancelled".
 */
export const cancelOldJobConfigsOnJobDispatch = async (
  db: Tx,
  jobConfigs: JobConfig[],
) => {
  if (jobConfigs.length === 0) return;
  const hasNoJobExecution = isNull(job.id);
  const environmentPolicyShouldCanncel = eq(
    environmentPolicy.releaseSequencing,
    "cancel",
  );
  const isAffectedEnvironment = inArray(
    environment.id,
    jobConfigs.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDispatchedJobConfig = notInArray(
    releaseJobTrigger.id,
    jobConfigs.map((t) => t.id),
  );
  const isNotDeleted = isNull(environment.deletedAt);
  const isNotSameRelease = notInArray(
    release.id,
    jobConfigs.map((t) => t.releaseId).filter(isPresent),
  );

  const oldJobConfigsToCancel = await db
    .select()
    .from(releaseJobTrigger)
    .leftJoin(job, eq(job.jobConfigId, releaseJobTrigger.id))
    .innerJoin(environment, eq(environment.id, releaseJobTrigger.environmentId))
    .innerJoin(release, eq(release.id, releaseJobTrigger.releaseId))
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
    )
    .where(
      and(
        hasNoJobExecution,
        environmentPolicyShouldCanncel,
        isAffectedEnvironment,
        isNotDispatchedJobConfig,
        isNotDeleted,
        isNotSameRelease,
      ),
    );

  if (oldJobConfigsToCancel.length === 0) return;

  await createJobExecutions(
    db,
    oldJobConfigsToCancel.map((t) => t.job_config),
    "cancelled",
  );
};
