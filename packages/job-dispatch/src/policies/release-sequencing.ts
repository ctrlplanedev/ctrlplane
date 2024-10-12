import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, notInArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleaseIdPolicyChecker } from "./utils.js";

/**
 * Checks if job configurations pass the release sequencing wait policy.
 *
 * This function filters job configurations based on the release sequencing wait
 * policy. It ensures that new jobs are only dispatched when there are
 * no active jobs in the same environment. This policy helps maintain
 * a sequential order of jobs within an environment.
 *
 * The function performs the following steps:
 * 1. If no release job triggers are provided, it returns an empty array.
 * 2. It queries the database for active jobs in the affected
 *    environments.
 * 3. It applies several conditions to find relevant active jobs:
 *    - The environment must be one of those in the provided release job triggers.
 *    - The environment must not be deleted.
 *    - The environment policy must have release sequencing set to "wait".
 *    - The job config must not be one of those provided (to avoid
 *      self-blocking).
 *    - The job must be in an active state (not completed, failed,
 *      etc.).
 * 4. Finally, it filters the input release job triggers, allowing only those where there
 *    are no active jobs in the same environment.
 *
 * @param db - The database transaction object.
 * @param releaseJobTriggers - An array of ReleaseJobTrigger objects to be checked.
 * @returns An array of ReleaseJobTrigger objects that pass the release sequencing wait
 * policy.
 */
export const isPassingReleaseSequencingWaitPolicy: ReleaseIdPolicyChecker =
  async (db, releaseJobTriggers) => {
    if (releaseJobTriggers.length === 0) return [];
    const isAffectedEnvironment = inArray(
      schema.environment.id,
      releaseJobTriggers.map((t) => t.environmentId).filter(isPresent),
    );
    const isNotDeletedEnvironment = isNull(schema.environment.deletedAt);
    const doesEnvironmentPolicyMatchesStatus = eq(
      schema.environmentPolicy.releaseSequencing,
      "wait",
    );
    const isNotDispatchedReleaseJobTrigger = notInArray(
      schema.releaseJobTrigger.id,
      releaseJobTriggers.map((t) => t.id).filter(isPresent),
    );
    const isActiveJob = eq(schema.job.status, JobStatus.InProgress);

    const activeJobs = await db
      .select()
      .from(schema.job)
      .innerJoin(
        schema.releaseJobTrigger,
        eq(schema.job.id, schema.releaseJobTrigger.jobId),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.environmentPolicy,
        eq(schema.environment.policyId, schema.environmentPolicy.id),
      )
      .where(
        and(
          isAffectedEnvironment,
          isNotDeletedEnvironment,
          doesEnvironmentPolicyMatchesStatus,
          isNotDispatchedReleaseJobTrigger,
          isActiveJob,
        ),
      );

    return releaseJobTriggers.filter((t) =>
      activeJobs.every((w) => w.environment.id !== t.environmentId),
    );
  };

/**
 * This function implements the release sequencing cancel policy. It determines
 * which release job triggers can proceed based on the current state of active
 * jobs in the environment. Here's what it does:
 *
 * 1. It filters out environments that are deleted or don't have a "cancel"
 *    release sequencing policy.
 * 2. It queries the database for active jobs in the affected environments.
 * 3. It then filters the input release job triggers, allowing only those where
 *    there are no active jobs in the same environment.
 *
 * The purpose of this policy is to ensure that when a new release is triggered
 * in an environment with a environment "cancel" policy configured, it will only
 * proceed if there are no other active jobs in that environment. This
 * effectively implements a "cancel and replace" strategy for releases in these
 * environments if enabled.
 *
 * @param db - The database transaction object
 * @param releaseJobTriggers - An array of release job triggers to be evaluated
 * @returns An array of release job triggers that pass the policy (i.e., can
 * proceed)
 */
export const isPassingReleaseSequencingCancelPolicy = async (
  db: Tx,
  releaseJobTriggers: schema.ReleaseJobTriggerInsert[],
) => {
  if (releaseJobTriggers.length === 0) return [];
  const isAffectedEnvironment = inArray(
    schema.environment.id,
    releaseJobTriggers.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDeletedEnvironment = isNull(schema.environment.deletedAt);
  const doesEnvironmentPolicyMatchesStatus = eq(
    schema.environmentPolicy.releaseSequencing,
    "cancel",
  );
  const isActiveJob = eq(schema.job.status, JobStatus.InProgress);

  const activeJobs = await db
    .select()
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.job.id, schema.releaseJobTrigger.jobId),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .where(
      and(
        isAffectedEnvironment,
        isNotDeletedEnvironment,
        doesEnvironmentPolicyMatchesStatus,
        isActiveJob,
      ),
    );

  return releaseJobTriggers.filter((t) =>
    activeJobs.every((w) => w.environment.id !== t.environmentId),
  );
};
