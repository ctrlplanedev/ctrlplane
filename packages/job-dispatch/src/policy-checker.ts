import type { Tx } from "@ctrlplane/db";
import type {
  EnvironmentPolicy,
  JobConfig,
  JobConfigInsert,
  Release,
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
  jobConfig,
  jobExecution,
  release,
} from "@ctrlplane/db/schema";

import { isJobConfigInRolloutWindow } from "./gradual-rollout";
import { isPassingLockingPolicy } from "./lock-checker";
import { isPassingReleaseDependencyPolicy } from "./release-checker";

const isSuccessCriteriaPassing = async (
  db: Tx,
  policy: EnvironmentPolicy,
  release: Release,
) => {
  if (policy.successType === "optional") return true;

  const wf = await db
    .select({
      status: jobExecution.status,
      count: sql<number>`count(*)`,
    })
    .from(jobConfig)
    .innerJoin(
      environmentPolicyDeployment,
      eq(environmentPolicyDeployment.environmentId, jobConfig.environmentId),
    )
    .leftJoin(jobExecution, eq(jobExecution.jobConfigId, jobConfig.id))
    .groupBy(jobExecution.status)
    .where(
      and(
        isNull(jobConfig.runbookId),
        eq(environmentPolicyDeployment.policyId, policy.id),
        eq(jobConfig.releaseId, release.id),
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
 * @param jobConfigs
 * @returns JobConfigs that pass the success criteria policy - the success criteria policy
 * will require a certain number of job executions to pass before dispatching.
 * * If the policy is set to all, all job executions must pass
 * * If the policy is set to optional, the job will be dispatched regardless of the success criteria.
 * * If the policy is set to minimum, a certain number of job executions must pass
 *
 */
const isPassingCriteriaPolicy = async (db: Tx, jobConfigs: JobConfig[]) => {
  if (jobConfigs.length === 0) return [];
  const policies = await db
    .select()
    .from(jobConfig)
    .innerJoin(release, eq(jobConfig.releaseId, release.id))
    .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .where(
      and(
        inArray(jobConfig.id, jobConfigs.map((t) => t.id).filter(isPresent)),
        isNull(environment.deletedAt),
      ),
    );

  return (
    await Promise.all(
      policies.map(async (p) => {
        if (p.environment_policy == null) return p.job_config;
        return (await isSuccessCriteriaPassing(
          db,
          p.environment_policy,
          p.release,
        ))
          ? p.job_config
          : null;
      }),
    )
  ).filter(isPresent);
};

/**
 *
 * @param db
 * @param jobConfigs
 * @returns JobConfigs that pass the approval policy - the approval policy will require manual approval
 * before dispatching if the policy is set to manual.
 */
const isPassingApprovalPolicy = async (db: Tx, jobConfigs: JobConfig[]) => {
  if (jobConfigs.length === 0) return [];
  const policies = await db
    .select()
    .from(jobConfig)
    .innerJoin(release, eq(jobConfig.releaseId, release.id))
    .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .leftJoin(
      environmentPolicyApproval,
      eq(environmentPolicyApproval.releaseId, release.id),
    )
    .where(
      and(
        inArray(jobConfig.id, jobConfigs.map((t) => t.id).filter(isPresent)),
        isNull(environment.deletedAt),
      ),
    );

  return policies
    .filter((p) => {
      if (p.environment_policy == null) return true;
      if (p.environment_policy.approvalRequirement === "automatic") return true;
      return p.environment_policy_approval?.status === "approved";
    })
    .map((p) => p.job_config);
};

/**
 *
 * @param db
 * @param jobConfigs
 * @returns JobConfigs that pass the rollout policy - the rollout policy will only allow a certain percentage of job executions to be dispatched
 * based on the duration of the policy and amount of time since the release was created. This percentage
 * will increase over the rollout window until all job executions are dispatched.
 */
const isPassingJobExecutionRolloutPolicy = async (
  db: Tx,
  jobConfigs: JobConfig[],
) => {
  if (jobConfigs.length === 0) return [];
  const policies = await db
    .select()
    .from(jobConfig)
    .innerJoin(release, eq(jobConfig.releaseId, release.id))
    .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .where(
      and(
        inArray(jobConfig.id, jobConfigs.map((t) => t.id).filter(isPresent)),
        isNull(environment.deletedAt),
      ),
    );

  return policies
    .filter((p) => {
      if (p.environment_policy == null) return true;
      return isJobConfigInRolloutWindow(
        [p.release.id, p.environment.id, p.job_config.targetId].join(":"),
        p.release.createdAt,
        p.environment_policy.duration,
      );
    })
    .map((p) => p.job_config);
};

const exitStatus = [
  "completed",
  "invalid_job_agent",
  "failure",
  "cancelled",
  "skipped",
] as any[];

/**
 *
 * @param db
 * @param jobConfigs
 * @returns JobConfigs that pass the release sequencing policy - the release sequencing wait policy
 * will wait for all other active job executions in the environment to complete before dispatching.
 */
const isPassingReleaseSequencingWaitPolicy = async (
  db: Tx,
  jobConfigs: JobConfig[],
) => {
  if (jobConfigs.length === 0) return [];
  const isAffectedEnvironment = inArray(
    environment.id,
    jobConfigs.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDeletedEnvironment = isNull(environment.deletedAt);
  const doesEnvironmentPolicyMatchesStatus = eq(
    environmentPolicy.releaseSequencing,
    "wait",
  );
  const isNotDispatchedJobConfig = notInArray(
    jobConfig.id,
    jobConfigs.map((t) => t.id).filter(isPresent),
  );
  const isActiveJobExecution = notInArray(jobExecution.status, exitStatus);

  const activeJobExecutions = await db
    .select()
    .from(jobExecution)
    .innerJoin(jobConfig, eq(jobExecution.jobConfigId, jobConfig.id))
    .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
    )
    .where(
      and(
        isAffectedEnvironment,
        isNotDeletedEnvironment,
        doesEnvironmentPolicyMatchesStatus,
        isNotDispatchedJobConfig,
        isActiveJobExecution,
      ),
    );

  return jobConfigs.filter((t) =>
    activeJobExecutions.every((w) => w.environment.id !== t.environmentId),
  );
};

/**
 *
 * @param db
 * @param jobConfigs
 * @returns JobConfigs that pass the release sequencing policy - the release sequencing cancel policy
 * will cancel all other active job executions in the environment.
 */
export const isPassingReleaseSequencingCancelPolicy = async (
  db: Tx,
  jobConfigs: JobConfigInsert[],
) => {
  if (jobConfigs.length === 0) return [];
  const isAffectedEnvironment = inArray(
    environment.id,
    jobConfigs.map((t) => t.environmentId).filter(isPresent),
  );
  const isNotDeletedEnvironment = isNull(environment.deletedAt);
  const doesEnvironmentPolicyMatchesStatus = eq(
    environmentPolicy.releaseSequencing,
    "cancel",
  );
  const isActiveJobExecution = notInArray(jobExecution.status, exitStatus);

  const activeJobExecutions = await db
    .select()
    .from(jobExecution)
    .innerJoin(jobConfig, eq(jobExecution.jobConfigId, jobConfig.id))
    .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
    .innerJoin(
      environmentPolicy,
      eq(environment.policyId, environmentPolicy.id),
    )
    .where(
      and(
        isAffectedEnvironment,
        isNotDeletedEnvironment,
        doesEnvironmentPolicyMatchesStatus,
        isActiveJobExecution,
      ),
    );

  return jobConfigs.filter((t) =>
    activeJobExecutions.every((w) => w.environment.id !== t.environmentId),
  );
};

/**
 *
 * @param date
 * @param startDate
 * @param endDate
 * @param recurrence
 * @returns Whether the date is in the time window defined by the start and end date
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
 * @param jobConfigs
 * @returns JobConfigs that pass the release window policy - the release window policy
 * defines the time window in which a release can be deployed.
 */
export const isPassingReleaseWindowPolicy = async (
  db: Tx,
  jobConfigs: JobConfig[],
): Promise<JobConfig[]> =>
  jobConfigs.length === 0
    ? []
    : db
        .select()
        .from(jobConfig)
        .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
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
              jobConfig.id,
              jobConfigs.map((t) => t.id).filter(isPresent),
            ),
            isNull(environment.deletedAt),
          ),
        )
        .then((policies) =>
          policies
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
            .reduce(
              (acc, { job_config }) =>
                acc.some((t) => t.id === job_config.id)
                  ? acc
                  : acc.concat(job_config),
              [] as JobConfig[],
            ),
        );

/**
 *
 * @param db
 * @param jobConfigs
 * @returns JobConfigs that pass the concurrency policy - the concurrency policy
 * will limit the number of job executions that can be dispatched in an environment.
 */
export const isPassingConcurrencyPolicy = async (
  db: Tx,
  jobConfigs: JobConfig[],
): Promise<JobConfig[]> => {
  if (jobConfigs.length === 0) return [];

  const activeJobExecutionSubquery = db
    .selectDistinct({
      count: sql<number>`count(*)`.as("count"),
      releaseId: jobConfig.releaseId,
      environmentId: jobConfig.environmentId,
    })
    .from(jobExecution)
    .innerJoin(jobConfig, eq(jobExecution.jobConfigId, jobConfig.id))
    .where(notInArray(jobExecution.status, exitStatus))
    .groupBy(jobConfig.releaseId, jobConfig.environmentId)
    .as("active_job_execution_subquery");

  return db
    .select()
    .from(jobConfig)
    .leftJoin(
      activeJobExecutionSubquery,
      and(
        eq(jobConfig.releaseId, activeJobExecutionSubquery.releaseId),
        eq(jobConfig.environmentId, activeJobExecutionSubquery.environmentId),
      ),
    )
    .innerJoin(environment, eq(jobConfig.environmentId, environment.id))
    .leftJoin(environmentPolicy, eq(environment.policyId, environmentPolicy.id))
    .where(
      inArray(
        jobConfig.id,
        jobConfigs.map((t) => t.id),
      ),
    )
    .then((data) =>
      _.chain(data)
        .groupBy((j) => [j.job_config.releaseId, j.job_config.environmentId])
        .map((jcs) =>
          jcs[0]!.environment_policy?.concurrencyType === "some"
            ? jcs.slice(
                0,
                Math.max(
                  0,
                  jcs[0]!.environment_policy.concurrencyLimit -
                    (jcs[0]!.active_job_execution_subquery?.count ?? 0),
                ),
              )
            : jcs,
        )
        .flatten()
        .map((jc) => jc.job_config)
        .value(),
    );
};

export const isPassingAllPolicies = async (db: Tx, jobConfigs: JobConfig[]) => {
  if (jobConfigs.length === 0) return [];
  const checks = [
    isPassingLockingPolicy,
    isPassingApprovalPolicy,
    isPassingCriteriaPolicy,
    isPassingConcurrencyPolicy,
    isPassingJobExecutionRolloutPolicy,
    isPassingReleaseSequencingWaitPolicy,
    isPassingReleaseWindowPolicy,
    isPassingReleaseDependencyPolicy,
  ];

  for (const check of checks) jobConfigs = await check(db, jobConfigs);

  return jobConfigs;
};
