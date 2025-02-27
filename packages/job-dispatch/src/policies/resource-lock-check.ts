import { and, eq, inArray, ne, sql, takeFirstOrNull } from "@ctrlplane/db";
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

  const releases = await db
    .select()
    .from(SCHEMA.release)
    .where(
      inArray(
        SCHEMA.release.id,
        releaseJobTriggers.map((rjt) => rjt.releaseId),
      ),
    );

  const jobs = await Promise.all(
    releaseJobTriggers.map(async (rjt) => {
      const release = releases.find((r) => r.id === rjt.releaseId);
      if (!release) return null;

      const runningReleaseJob = await db
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
            eq(SCHEMA.release.deploymentId, release.deploymentId),
            eq(SCHEMA.releaseJobTrigger.resourceId, rjt.resourceId),
            ne(SCHEMA.releaseJobTrigger.id, rjt.id),
          ),
        )
        .limit(1)
        .then(takeFirstOrNull);

      const runningDeploymentHook = await db
        .select()
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
          SCHEMA.runhook,
          eq(SCHEMA.runhook.runbookId, SCHEMA.runbookJobTrigger.runbookId),
        )
        .innerJoin(SCHEMA.hook, eq(SCHEMA.runhook.hookId, SCHEMA.hook.id))
        .where(
          and(
            eq(SCHEMA.hook.scopeType, "deployment"),
            eq(SCHEMA.hook.scopeId, release.deploymentId),
            eq(SCHEMA.hook.action, "deployment.resource.removed"),
            eq(SCHEMA.job.status, JobStatus.InProgress),
            eq(SCHEMA.jobVariable.key, "resourceId"),
            sql`${SCHEMA.jobVariable.value}::jsonb = ${JSON.stringify(rjt.resourceId)}::jsonb`,
          ),
        )
        .limit(1)
        .then(takeFirstOrNull);

      if (runningReleaseJob || runningDeploymentHook) return null;

      return rjt;
    }),
  );

  return jobs.filter((rjt) => rjt != null);
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
          sql`${SCHEMA.jobVariable.value}::jsonb = ${JSON.stringify(jobInfo.job_variable.value)}::jsonb`,
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
