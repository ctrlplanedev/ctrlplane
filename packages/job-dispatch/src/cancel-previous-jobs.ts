import type { Tx } from "@ctrlplane/db";

import { and, eq, ne, or } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { updateJob } from "./job-update.js";

export const cancelPreviousJobsForRedeployedTriggers = async (
  db: Tx,
  releaseJobTriggers: schema.ReleaseJobTrigger[],
): Promise<void> => {
  if (releaseJobTriggers.length === 0) return;

  const jobsToCancel = await db
    .select()
    .from(schema.job)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.job.id, schema.releaseJobTrigger.jobId),
    )
    .where(
      or(
        ...releaseJobTriggers.map((trigger) =>
          and(
            eq(schema.releaseJobTrigger.releaseId, trigger.releaseId),
            eq(schema.releaseJobTrigger.environmentId, trigger.environmentId),
            eq(schema.releaseJobTrigger.resourceId, trigger.resourceId),
            eq(schema.job.status, JobStatus.Pending),
            ne(schema.job.id, trigger.jobId),
          ),
        ),
      ),
    );

  const jobIdsToCancel = jobsToCancel.map((job) => job.job.id);
  await Promise.all(
    jobIdsToCancel.map((jobId) =>
      updateJob(db, jobId, { status: JobStatus.Cancelled }),
    ),
  );
};
