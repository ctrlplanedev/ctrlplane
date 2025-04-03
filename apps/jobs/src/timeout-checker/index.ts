import { and, eq, isNotNull, lt, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { updateJob } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

const log = logger.child({ module: "timeout-checker" });

export const run = async () =>
  db
    .select({ id: SCHEMA.job.id })
    .from(SCHEMA.deployment)
    .innerJoin(
      SCHEMA.deploymentVersion,
      eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
    )
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
    )
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
    .where(
      and(
        isNotNull(SCHEMA.deployment.timeout),
        eq(SCHEMA.job.status, JobStatus.InProgress),
        lt(
          SCHEMA.job.createdAt,
          sql`now() - ${SCHEMA.deployment.timeout} * interval '1 second'`,
        ),
      ),
    )
    .then((jobs) => {
      Promise.all(
        jobs.map(async (job) => {
          log.error(`Job ${job.id} timed out`, { job });
          await updateJob(db, job.id, {
            status: JobStatus.Failure,
            message: `Job timed out`,
          });
        }),
      );
    });
