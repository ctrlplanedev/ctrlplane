import type { Tx } from "@ctrlplane/db";

import { and, eq, exists, ne, or, sql, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type {
  ReleaseIdPolicyChecker,
  RunbookJobPolicyChecker,
} from "./utils.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the resource lock check - there cannot be an active job
 * for the resource in the same deployment (includes deployment hooks)
 */
export const isPassingResourceLockCheck: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
) => {
  if (releaseJobTriggers.length === 0) return [];

  const isRunningReleaseJob = exists(
    sql`
      SELECT 1
      FROM ${SCHEMA.job}
      INNER JOIN ${SCHEMA.releaseJobTrigger} as rjt on rjt.job_id = ${SCHEMA.job.id}
      INNER JOIN ${SCHEMA.release} as r on rjt.release_id = r.id
      WHERE rjt.id != ${SCHEMA.releaseJobTrigger.id}
      AND rjt.resource_id = ${SCHEMA.releaseJobTrigger.resourceId}
      and r.deployment_id = ${SCHEMA.release.deploymentId}
      and ${SCHEMA.job.status} = ${JobStatus.InProgress}
      LIMIT 1
    `,
  );

  const isRunningDeploymentHook = (db: Tx) =>
    exists(
      db
        .select({ value: sql<number>`1` })
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.jobVariable,
          eq(SCHEMA.jobVariable.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.runbookJobTrigger,
          eq(SCHEMA.runbookJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.runbook,
          eq(SCHEMA.runbook.id, SCHEMA.runbookJobTrigger.runbookId),
        )
        .innerJoin(
          SCHEMA.runhook,
          eq(SCHEMA.runhook.runbookId, SCHEMA.runbook.id),
        )
        .innerJoin(SCHEMA.hook, eq(SCHEMA.hook.id, SCHEMA.runhook.hookId))
        .where(
          and(
            eq(SCHEMA.hook.scopeType, "deployment"),
            eq(SCHEMA.hook.scopeId, SCHEMA.release.deploymentId),
            eq(SCHEMA.hook.action, "deployment.resource.removed"),
            eq(SCHEMA.job.status, JobStatus.InProgress),
            eq(SCHEMA.jobVariable.key, "resourceId"),
            eq(SCHEMA.jobVariable.value, SCHEMA.releaseJobTrigger.resourceId),
          ),
        )
        .limit(1),
    );

  const blockedJobs = await db
    .select()
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.release.id),
    )
    .where(or(isRunningReleaseJob, isRunningDeploymentHook(db)));

  return releaseJobTriggers.filter(
    (rjt) => !blockedJobs.some((jb) => jb.release_job_trigger.id === rjt.id),
  );
};

export const isRunbookJobPassingResourceLockCheck: RunbookJobPolicyChecker =
  async (db, runbookJobTrigger) => {
    const hookInfo = await db
      .select()
      .from(SCHEMA.runbook)
      .innerJoin(
        SCHEMA.runhook,
        eq(SCHEMA.runhook.runbookId, SCHEMA.runbook.id),
      )
      .innerJoin(SCHEMA.hook, eq(SCHEMA.hook.id, SCHEMA.runhook.hookId))
      .where(
        and(
          eq(SCHEMA.hook.scopeType, "deployment"),
          eq(SCHEMA.hook.action, "deployment.resource.removed"),
          eq(SCHEMA.runbook.id, runbookJobTrigger.runbookId),
        ),
      )
      .then(takeFirstOrNull);

    if (!hookInfo) return true;

    const jobInfo = await db
      .select()
      .from(SCHEMA.job)
      .innerJoin(
        SCHEMA.jobVariable,
        eq(SCHEMA.jobVariable.jobId, SCHEMA.job.id),
      )
      .where(
        and(
          eq(SCHEMA.jobVariable.key, "resourceId"),
          eq(SCHEMA.job.id, runbookJobTrigger.jobId),
        ),
      )
      .then(takeFirstOrNull);

    if (!jobInfo) return true;

    const inProgressReleaseJobPromise = db
      .select()
      .from(SCHEMA.job)
      .innerJoin(
        SCHEMA.releaseJobTrigger,
        eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
      )
      .innerJoin(
        SCHEMA.release,
        eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.release.id),
      )
      .where(
        and(
          eq(SCHEMA.job.status, JobStatus.InProgress),
          eq(SCHEMA.release.deploymentId, hookInfo.hook.scopeId),
          eq(
            SCHEMA.releaseJobTrigger.resourceId,
            String(jobInfo.job_variable.value),
          ),
        ),
      )
      .limit(1)
      .then(takeFirstOrNull);

    const inProgressHookJobPromise = db
      .select()
      .from(SCHEMA.job)
      .innerJoin(
        SCHEMA.runbookJobTrigger,
        eq(SCHEMA.runbookJobTrigger.jobId, SCHEMA.job.id),
      )
      .innerJoin(
        SCHEMA.jobVariable,
        eq(SCHEMA.jobVariable.jobId, SCHEMA.job.id),
      )
      .where(
        and(
          eq(SCHEMA.job.status, JobStatus.InProgress),
          eq(SCHEMA.jobVariable.key, "resourceId"),
          eq(SCHEMA.jobVariable.value, String(jobInfo.job_variable.value)),
          eq(SCHEMA.runbookJobTrigger.runbookId, runbookJobTrigger.runbookId),
          ne(SCHEMA.job.id, runbookJobTrigger.jobId),
        ),
      )
      .limit(1)
      .then(takeFirstOrNull);

    const [inProgressReleaseJob, inProgressHookJob] = await Promise.all([
      inProgressReleaseJobPromise,
      inProgressHookJobPromise,
    ]);

    return inProgressReleaseJob == null && inProgressHookJob == null;
  };
