import { and, count, eq, ne, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";
import { cancelOldReleaseJobTriggersOnJobDispatch } from "./release-sequencing.js";

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

  const releaseJobTriggers = await db
    .select({ count: count() })
    .from(schema.releaseJobTrigger)
    .where(
      and(
        eq(schema.releaseJobTrigger.releaseId, jobInfo.deployment_version.id),
        eq(
          schema.releaseJobTrigger.environmentId,
          jobInfo.release_job_trigger.environmentId,
        ),
        eq(
          schema.releaseJobTrigger.resourceId,
          jobInfo.release_job_trigger.resourceId,
        ),
        ne(schema.releaseJobTrigger.id, jobInfo.release_job_trigger.id),
      ),
    )
    .then(takeFirst);

  const { count: releaseJobTriggerCount } = releaseJobTriggers;

  if (releaseJobTriggerCount >= jobInfo.deployment.retryCount) return;

  const createTrigger = createReleaseJobTriggers(db, "retry")
    .releases([jobInfo.deployment_version.id])
    .resources([jobInfo.release_job_trigger.resourceId])
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
        `Retry job for deployment version ${jobInfo.deployment_version.id} and resource ${jobInfo.release_job_trigger.resourceId} created and dispatched.`,
      ),
    );
};
