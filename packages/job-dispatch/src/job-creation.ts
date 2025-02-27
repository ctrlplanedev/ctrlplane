import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import {
  and,
  desc,
  eq,
  isNotNull,
  ne,
  or,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { dispatchReleaseJobTriggers, dispatchRunbook } from "./job-dispatch.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { cancelOldReleaseJobTriggersOnJobDispatch } from "./release-sequencing.js";

export const createTriggeredRunbookJob = async (
  db: Tx,
  runbook: schema.Runbook,
  variableValues: Record<string, any>,
): Promise<{
  job: schema.Job;
  runbookJobTrigger: schema.RunbookJobTrigger;
}> => {
  logger.info(`Triger triggered runbook job ${runbook.name}`, {
    runbook,
    variableValues,
  });

  if (runbook.jobAgentId == null)
    throw new Error("Cannot dispatch runbooks without agents.");

  const jobAgent = await db
    .select()
    .from(schema.jobAgent)
    .where(eq(schema.jobAgent.id, runbook.jobAgentId))
    .then(takeFirst);

  const job = await db
    .insert(schema.job)
    .values({
      jobAgentId: jobAgent.id,
      jobAgentConfig: _.merge(jobAgent.config, runbook.jobAgentConfig),
      status: JobStatus.Pending,
    })
    .returning()
    .then(takeFirst);

  const runbookJobTrigger = await db
    .insert(schema.runbookJobTrigger)
    .values({ jobId: job.id, runbookId: runbook.id })
    .returning()
    .then(takeFirst);

  logger.info(`Created triggered runbook job`, { jobId: job.id });

  const variables = Object.entries(variableValues).map(([key, value]) => ({
    key,
    value,
    jobId: job.id,
  }));

  if (variables.length > 0)
    await db.insert(schema.jobVariable).values(variables);

  return { job, runbookJobTrigger };
};

/**
 * When a job completes, there may be other jobs that should now be triggered
 * because the completion of this job means that some policies are now passing.
 *
 * criteria requirement - "need n from QA to pass before deploying to staging"
 * wait requirement - "in the same environment, need to wait for previous release to be deployed first"
 * concurrency requirement - "only n releases in staging at a time"
 * version dependency - "need to wait for deployment X version Y to be deployed first"
 *
 *
 * This function looks at the job's release and deployment and finds all the
 * other release that should be triggered and dispatches them.
 *
 * @param je
 */
export const onJobSuccess = async (je: schema.Job) => {
  const triggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.releaseJobTrigger.jobId, je.id))
    .then(takeFirst);

  const isDependentOnTriggerForCriteria = and(
    eq(schema.releaseJobTrigger.releaseId, triggers.release.id),
    eq(
      schema.environmentPolicyDeployment.environmentId,
      triggers.release_job_trigger.environmentId,
    ),
  );

  const isWaitingOnConcurrencyRequirementInSameRelease = and(
    isNotNull(schema.environmentPolicy.concurrencyLimit),
    eq(schema.environment.id, triggers.release_job_trigger.environmentId),
    eq(schema.releaseJobTrigger.releaseId, triggers.release.id),
    eq(schema.job.status, JobStatus.Pending),
  );

  const isDependentOnVersionOfTriggerDeployment = isNotNull(
    schema.releaseDependency.id,
  );

  const isWaitingOnJobToFinish = and(
    eq(schema.environment.id, triggers.release_job_trigger.environmentId),
    eq(schema.deployment.id, triggers.deployment.id),
    ne(schema.release.id, triggers.release.id),
  );

  const affectedReleaseJobTriggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .leftJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .leftJoin(
      schema.environmentPolicyDeployment,
      eq(
        schema.environmentPolicyDeployment.policyId,
        schema.environmentPolicy.id,
      ),
    )
    .leftJoin(
      schema.releaseDependency,
      and(
        eq(
          schema.releaseDependency.releaseId,
          schema.releaseJobTrigger.releaseId,
        ),
        eq(schema.releaseDependency.deploymentId, triggers.deployment.id),
      ),
    )
    .where(
      and(
        eq(schema.job.status, JobStatus.Pending),
        or(
          isDependentOnTriggerForCriteria,
          isWaitingOnJobToFinish,
          isWaitingOnConcurrencyRequirementInSameRelease,
          isDependentOnVersionOfTriggerDeployment,
        ),
      ),
    );

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(
      affectedReleaseJobTriggers.map((t) => t.release_job_trigger),
    )
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};

export const onJobCompletion = async (je: schema.Job) => {
  const jobReleaseInfoPromise = db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .where(eq(schema.releaseJobTrigger.jobId, je.id))
    .then(takeFirstOrNull);

  const jobHookInfoPromise = db
    .select()
    .from(schema.runbookJobTrigger)
    .innerJoin(
      schema.jobVariable,
      eq(schema.runbookJobTrigger.jobId, schema.jobVariable.jobId),
    )
    .innerJoin(
      schema.runhook,
      eq(schema.runbookJobTrigger.runbookId, schema.runhook.runbookId),
    )
    .innerJoin(schema.hook, eq(schema.runhook.hookId, schema.hook.id))
    .where(
      and(
        eq(schema.jobVariable.key, "resourceId"),
        eq(schema.runbookJobTrigger.jobId, je.id),
        eq(schema.hook.scopeType, "deployment"),
      ),
    )
    .then(takeFirstOrNull);

  const [jobReleaseInfo, jobHookInfo] = await Promise.all([
    jobReleaseInfoPromise,
    jobHookInfoPromise,
  ]);

  if (jobReleaseInfo == null && jobHookInfo == null) return;

  const deploymentId =
    jobReleaseInfo != null
      ? jobReleaseInfo.release.deploymentId
      : jobHookInfo!.hook.scopeId;

  const resourceId =
    jobReleaseInfo != null
      ? jobReleaseInfo.release_job_trigger.resourceId
      : String(jobHookInfo!.job_variable.value);

  console.log({
    deploymentId,
    resourceId,
  });

  const latestReleaseJobTriggerPromise = db
    .select()
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.job.id, schema.releaseJobTrigger.jobId),
    )
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .where(
      and(
        ne(schema.job.id, je.id),
        eq(schema.job.status, JobStatus.Pending),
        eq(schema.release.deploymentId, deploymentId),
        eq(schema.releaseJobTrigger.resourceId, resourceId),
      ),
    )
    .orderBy(desc(schema.job.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  const latestRunbookJobTriggerPromise = db
    .select()
    .from(schema.job)
    .innerJoin(schema.jobVariable, eq(schema.job.id, schema.jobVariable.jobId))
    .innerJoin(
      schema.runbookJobTrigger,
      eq(schema.runbookJobTrigger.jobId, schema.job.id),
    )
    .innerJoin(
      schema.runhook,
      eq(schema.runbookJobTrigger.runbookId, schema.runhook.runbookId),
    )
    .innerJoin(schema.hook, eq(schema.runhook.hookId, schema.hook.id))
    .where(
      and(
        ne(schema.job.id, je.id),
        eq(schema.job.status, JobStatus.Pending),
        eq(schema.jobVariable.key, "resourceId"),
        sql`${schema.jobVariable.value}::jsonb = ${JSON.stringify(resourceId)}::jsonb`,
        eq(schema.hook.scopeType, "deployment"),
        eq(schema.hook.scopeId, deploymentId),
      ),
    )
    .orderBy(desc(schema.job.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  const [latestReleaseJobTrigger, latestRunbookJobTrigger] = await Promise.all([
    latestReleaseJobTriggerPromise,
    latestRunbookJobTriggerPromise,
  ]);

  console.log({
    latestReleaseJobTrigger,
    latestRunbookJobTrigger,
  });

  if (
    latestReleaseJobTrigger != null &&
    latestReleaseJobTrigger.job.createdAt >
      (latestRunbookJobTrigger?.job.createdAt ?? 0)
  ) {
    dispatchReleaseJobTriggers(db)
      .releaseTriggers([latestReleaseJobTrigger.release_job_trigger])
      .filter(isPassingAllPolicies)
      .then(cancelOldReleaseJobTriggersOnJobDispatch)
      .dispatch();
  }

  if (
    latestRunbookJobTrigger != null &&
    latestRunbookJobTrigger.job.createdAt >
      (latestReleaseJobTrigger?.job.createdAt ?? 0)
  ) {
    dispatchRunbook(db, latestRunbookJobTrigger.runbook_job_trigger.runbookId, {
      resourceId,
      deploymentId,
    });
  }
};
