import type { Tx } from "@ctrlplane/db";

import { and, count, eq, ne, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
} from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

const log = logger.child({ label: "job-update" });

export const onJobFailure = async (db: Tx, job: schema.Job) => {
  const jobInfo = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.deploymentVersion,
      eq(schema.releaseJobTrigger.versionId, schema.deploymentVersion.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
    )
    .where(eq(schema.releaseJobTrigger.jobId, job.id))
    .then(takeFirstOrNull);

  if (jobInfo == null) return;

  const releaseJobTriggers = await db
    .select({ count: count() })
    .from(schema.releaseJobTrigger)
    .where(
      and(
        eq(schema.releaseJobTrigger.versionId, jobInfo.deployment_version.id),
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
    .versions([jobInfo.deployment_version.id])
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
      log.info(
        `Retry job for deployment version ${jobInfo.deployment_version.id} and resource ${jobInfo.release_job_trigger.resourceId} created and dispatched.`,
      ),
    );
};
