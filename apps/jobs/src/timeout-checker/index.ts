import { and, eq, isNotNull, lt, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { updateJob } from "@ctrlplane/job-dispatch";
import { JobStatus } from "@ctrlplane/validators/jobs";

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
      eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.deploymentVersion.id),
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
    .then(async (jobs) => {
      await Promise.all(
        jobs.map((job) => updateJob(db, job.id, { status: JobStatus.Failure })),
      );
    });
