import type { Tx } from "@ctrlplane/db";
import type {
  EnvironmentPolicy,
  Release,
  ReleaseJobTrigger,
  ReleaseJobTriggerInsert,
} from "@ctrlplane/db/schema";
import { addMonths, addWeeks, isBefore, isWithinInterval } from "date-fns";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull, notInArray, sql } from "@ctrlplane/db";
import {
  environment,
  environmentPolicy,
  environmentPolicyApproval,
  environmentPolicyDeployment,
  environmentPolicyReleaseWindow,
  job,
  release,
  releaseJobTrigger,
} from "@ctrlplane/db/schema";

import { isReleaseJobTriggerInRolloutWindow } from "./gradual-rollout.js";
import { isPassingLockingPolicy } from "./lock-checker.js";
import { isPassingReleaseDependencyPolicy } from "./release-checker.js";

const isSuccessCriteriaPassing = async (
  db: Tx,
  policy: EnvironmentPolicy,
  release: Release,
) => {
  if (policy.successType === "optional") return true;

  const wf = await db
    .select({
      status: job.status,
      count: sql<number>`count(*)`,
    })
    .from(releaseJobTrigger)
    .innerJoin(
      environmentPolicyDeployment,
      eq(
        environmentPolicyDeployment.environmentId,
        releaseJobTrigger.environmentId,
      ),
    )
    .leftJoin(job, eq(job.id, releaseJobTrigger.jobId))
    .groupBy(job.status)
    .where(
      and(
        eq(environmentPolicyDeployment.policyId, policy.id),
        eq(releaseJobTrigger.releaseId, release.id),
      ),
    );

  if (policy.successType === "all")
    return wf.every(({ status, count }) =>
      status === "completed" ? true : count === 0,
    );

  const completed = wf.find((w) => w.status === "completed")?.count ?? 0;
  return completed >= policy.successMinimum;
};

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the success criteria policy - the success criteria policy
 * will require a certain number of jobs to pass before dispatching.
 * * If the policy is set to all, all jobs must pass
 * * If the policy is set to optional, the job will be dispatched regardless of the success criteria.
 * * If the policy is set to minimum, a certain number of jobs must pass
 *
 */
const isPassingCriteriaPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];
  const policies = await db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .where(
      and(
        inArray(
          releaseJobTrigger.id,
          releaseJobTriggers.map((t) => t.id),
        ),
        isNull(environment.deletedAt),
      ),
    );

  return Promise.all(
    policies.map(async (policy) => {
      if (!policy.environment_policy) return policy.release_job_trigger;

      const isPassing = await isSuccessCriteriaPassing(
        db,
        policy.environment_policy,
        policy.release,
      );

      return isPassing ? policy.release_job_trigger : null;
    }),
  ).then((results) => results.filter(isPresent));
};

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the approval policy - the approval policy will
 * require manual approval before dispatching if the policy is set to manual.
 */
export const isPassingApprovalPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];
  const policies = await db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .leftJoin(
      environmentPolicyApproval,
      eq(environmentPolicyApproval.releaseId, release.id),
    )
    .where(
      and(
        inArray(
          releaseJobTrigger.id,
          releaseJobTriggers.map((t) => t.id),
        ),
        isNull(environment.deletedAt),
      ),
    );

  return policies
    .filter((p) => {
      if (p.environment_policy == null) return true;
      if (p.environment_policy.approvalRequirement === "automatic") return true;
      return p.environment_policy_approval?.status === "approved";
    })
    .map((p) => p.release_job_trigger);
};

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the rollout policy - the rollout policy will
 * only allow a certain percentage of jobs to be dispatched based on
 * the duration of the policy and amount of time since the release was created.
 * This percentage will increase over the rollout window until all job
 * executions are dispatched.
 */
const isPassingJobRolloutPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];
  const policies = await db
    .select()
    .from(releaseJobTrigger)
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .where(
      and(
        inArray(
          releaseJobTrigger.id,
          releaseJobTriggers.map((t) => t.id).filter(isPresent),
        ),
        isNull(environment.deletedAt),
      ),
    );

  return policies
    .filter((p) => {
      if (p.environment_policy == null) return true;
      return isReleaseJobTriggerInRolloutWindow(
        [p.release.id, p.environment.id, p.release_job_trigger.targetId].join(
          ":",
        ),
        p.release.createdAt,
        p.environment_policy.duration,
      );
    })
    .map((p) => p.release_job_trigger);
};

const exitStatus = [
  "completed",
  "invalid_job_agent",
  "failure",
  "cancelled",
  "skipped",
] as any[];

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
const isPassingReleaseSequencingWaitPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];
  const isAffectedEnvironment = inArray(
    environment.id,
    releaseJobTriggers.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDeletedEnvironment = isNull(environment.deletedAt);
  const doesEnvironmentPolicyMatchesStatus = eq(
    environmentPolicy.releaseSequencing,
    "wait",
  );
  const isNotDispatchedReleaseJobTrigger = notInArray(
    releaseJobTrigger.id,
    releaseJobTriggers.map((t) => t.id).filter(isPresent),
  );
  const isActiveJob = notInArray(job.status, exitStatus);

  const activeJobs = await db
    .select()
    .from(job)
    .innerJoin(releaseJobTrigger, eq(job.id, releaseJobTrigger.jobId))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
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
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the release sequencing policy - the release
 * sequencing cancel policy will cancel all other active jobs in the
 * environment.
 */
export const isPassingReleaseSequencingCancelPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTriggerInsert[],
) => {
  if (releaseJobTriggers.length === 0) return [];
  const isAffectedEnvironment = inArray(
    environment.id,
    releaseJobTriggers.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDeletedEnvironment = isNull(environment.deletedAt);
  const doesEnvironmentPolicyMatchesStatus = eq(
    environmentPolicy.releaseSequencing,
    "cancel",
  );
  const isActiveJob = notInArray(job.status, exitStatus);

  const activeJobs = await db
    .select()
    .from(job)
    .innerJoin(releaseJobTrigger, eq(job.id, releaseJobTrigger.jobId))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
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

/**
 *
 * @param date
 * @param startDate
 * @param endDate
 * @param recurrence
 * @returns Whether the date is in the time window defined by the start and end
 * date
 */
export const isDateInTimeWindow = (
  date: Date,
  startDate: Date,
  endDate: Date,
  recurrence: string,
) => {
  let intervalStart = startDate;
  let intervalEnd = endDate;

  const addTimeFunc: (date: string | number | Date, amount: number) => Date =
    recurrence === "weekly" ? addWeeks : addMonths;

  while (isBefore(intervalStart, date)) {
    if (isWithinInterval(date, { start: intervalStart, end: intervalEnd }))
      return { isInWindow: true, nextIntervalStart: intervalStart };

    intervalStart = addTimeFunc(intervalStart, 1);
    intervalEnd = addTimeFunc(intervalEnd, 1);
  }

  return { isInWindow: false, nextIntervalStart: intervalStart };
};

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the release window policy - the release window
 * policy defines the time window in which a release can be deployed.
 */
export const isPassingReleaseWindowPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
): Promise<ReleaseJobTrigger[]> =>
  releaseJobTriggers.length === 0
    ? []
    : db
        .select()
        .from(releaseJobTrigger)
        .innerJoin(
          environment,
          eq(releaseJobTrigger.environmentId, environment.id),
        )
        .leftJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .where(
          and(
            inArray(
              releaseJobTrigger.id,
              releaseJobTriggers.map((t) => t.id).filter(isPresent),
            ),
            isNull(environment.deletedAt),
          ),
        )
        .then((policies) =>
          _.chain(policies)
            .filter(
              ({ environment_policy_release_window }) =>
                environment_policy_release_window == null ||
                isDateInTimeWindow(
                  new Date(),
                  environment_policy_release_window.startTime,
                  environment_policy_release_window.endTime,
                  environment_policy_release_window.recurrence,
                ).isInWindow,
            )
            .map((m) => m.release_job_trigger)
            .uniqBy((m) => m.id)
            .value(),
        );

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the concurrency policy - the concurrency policy
 * will limit the number of jobs that can be dispatched in an
 * environment.
 */
const isPassingConcurrencyPolicy = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
): Promise<ReleaseJobTrigger[]> => {
  if (releaseJobTriggers.length === 0) return [];

  const activeJobSubquery = db
    .selectDistinct({
      count: sql<number>`count(*)`.as("count"),
      releaseId: releaseJobTrigger.releaseId,
      environmentId: releaseJobTrigger.environmentId,
    })
    .from(job)
    .innerJoin(releaseJobTrigger, eq(job.id, releaseJobTrigger.jobId))
    .where(notInArray(job.status, exitStatus))
    .groupBy(releaseJobTrigger.releaseId, releaseJobTrigger.environmentId)
    .as("active_job_subquery");

  return db
    .select()
    .from(releaseJobTrigger)
    .leftJoin(
      activeJobSubquery,
      and(
        eq(releaseJobTrigger.releaseId, activeJobSubquery.releaseId),
        eq(releaseJobTrigger.environmentId, activeJobSubquery.environmentId),
      ),
    )
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .where(
      inArray(
        releaseJobTrigger.id,
        releaseJobTriggers.map((t) => t.id),
      ),
    )
    .then((data) =>
      _.chain(data)
        .groupBy((j) => [
          j.release_job_trigger.releaseId,
          j.release_job_trigger.environmentId,
        ])
        .map((jcs) =>
          // Check if the concurrency policy type is "some"
          jcs[0]!.environment_policy?.concurrencyType === "some"
            ? // If so, limit the number of release job triggers based on the concurrency limit
              jcs.slice(
                0,
                Math.max(
                  0,
                  jcs[0]!.environment_policy.concurrencyLimit -
                    (jcs[0]!.active_job_subquery?.count ?? 0),
                ),
              )
            : // If not, return all release job triggers in the group
              jcs,
        )
        .flatten()
        .map((jc) => jc.release_job_trigger)
        .value(),
    );
};

export const isPassingAllPolicies = async (
  db: Tx,
  releaseJobTriggers: ReleaseJobTrigger[],
) => {
  if (releaseJobTriggers.length === 0) return [];
  const checks = [
    isPassingLockingPolicy,
    isPassingApprovalPolicy,
    isPassingCriteriaPolicy,
    isPassingConcurrencyPolicy,
    isPassingJobRolloutPolicy,
    isPassingReleaseSequencingWaitPolicy,
    isPassingReleaseWindowPolicy,
    isPassingReleaseDependencyPolicy,
  ];

  let passingJobs = releaseJobTriggers;
  for (const check of checks) passingJobs = await check(db, passingJobs);

  return passingJobs;
};

/**
 * Critical checks that must pass, and if they fail, we should try to deploy an
 * earlier release
 */
export const criticalChecks = [isPassingLockingPolicy, isPassingApprovalPolicy];

/**
 * Critical checks that must pass, but don't require trying an earlier release
 * if they fail
 */
export const terminalChecks = [
  isPassingReleaseDependencyPolicy,
  isPassingReleaseSequencingWaitPolicy,
];

/**
 * Non-critical checks that influence dispatch but don't necessarily prevent it
 */
export const nonCriticalChecks = [
  isPassingCriteriaPolicy,
  isPassingReleaseWindowPolicy,
  isPassingConcurrencyPolicy,
  isPassingJobRolloutPolicy,
];
