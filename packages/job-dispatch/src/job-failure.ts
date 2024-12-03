import {
  and,
  count,
  desc,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";
import { cancelOldReleaseJobTriggersOnJobDispatch } from "./release-sequencing.js";

const dispatchJobsForNewerRelease = async (releaseId: string) => {
  const releaseJobTriggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .where(
      and(
        eq(schema.releaseJobTrigger.releaseId, releaseId),
        eq(schema.job.status, JobStatus.Pending),
      ),
    )
    .then((rows) => rows.map((r) => r.release_job_trigger));

  return dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPolicies)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};

export const onJobFailure = async (job: schema.Job) => {
  const jobInfo = await db
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
    .where(eq(schema.releaseJobTrigger.jobId, job.id))
    .then(takeFirstOrNull);

  if (jobInfo == null) return;

  const latestRelease = await db
    .select()
    .from(schema.release)
    .where(eq(schema.release.deploymentId, jobInfo.deployment.id))
    .orderBy(desc(schema.release.createdAt))
    .limit(1)
    .then(takeFirst);

  if (latestRelease.id !== jobInfo.release.id)
    return dispatchJobsForNewerRelease(latestRelease.id);

  const releaseJobTriggers = await db
    .select({ count: count() })
    .from(schema.releaseJobTrigger)
    .where(eq(schema.releaseJobTrigger.releaseId, jobInfo.release.id))
    .then(takeFirst);

  const { count: releaseJobTriggerCount } = releaseJobTriggers;

  if (releaseJobTriggerCount >= jobInfo.deployment.retryCount) return;

  const createTrigger = createReleaseJobTriggers(db, "retry")
    .releases([jobInfo.release.id])
    .environments([jobInfo.release_job_trigger.environmentId]);

  const trigger =
    jobInfo.release_job_trigger.causedById != null
      ? await createTrigger
          .causedById(jobInfo.release_job_trigger.causedById)
          .insert()
      : await createTrigger.insert();

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(trigger)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch()
    .then(() =>
      logger.info(
        `Retry job for release ${jobInfo.release.id} and resource ${jobInfo.release_job_trigger.resourceId} created and dispatched.`,
      ),
    );
};
