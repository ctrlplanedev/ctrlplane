import { eq, sql } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import {
  Channel,
  createWorker,
  dispatchQueueJob,
  getQueue,
} from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import {
  exitedStatus,
  failedStatuses,
  JobStatus,
} from "@ctrlplane/validators/jobs";

import { dbUpdateJob } from "./db-update-job.js";
import { updateJobMetadata } from "./job-metadata.js";
import { getNumRetryAttempts, retryJob } from "./job-retry.js";
import { getMatchedPolicies } from "./matched-policies.js";
import { triggerDependentTargets } from "./trigger-dependent-targets.js";
import { getReleaseTarget } from "./utils.js";

const log = logger.child({ worker: "job-update" });

const getIsJobJustCompleted = (
  previousStatus: JobStatus,
  newStatus: JobStatus,
) => {
  const isPreviousStatusExited = exitedStatus.includes(previousStatus);
  const isNewStatusExited = exitedStatus.includes(newStatus);
  return !isPreviousStatusExited && isNewStatusExited;
};

export const updateJobWorker = createWorker(Channel.UpdateJob, async (job) => {
  const { jobId, data, metadata } = job.data;

  const jobBeforeUpdate = await db.query.job.findFirst({
    where: eq(schema.job.id, jobId),
    with: { metadata: true },
  });
  if (jobBeforeUpdate == null) throw new Error("Job not found");

  try {
    const job = await db.transaction(async (tx) => {
      await tx.execute(
        sql`
          SELECT * FROM ${schema.job}
          WHERE ${eq(schema.job.id, jobId)}
          FOR UPDATE NOWAIT
        `,
      );

      const updatedJob = await dbUpdateJob(tx, jobId, jobBeforeUpdate, data);
      if (metadata != null)
        await updateJobMetadata(tx, jobId, jobBeforeUpdate.metadata, metadata);

      const isJobJustCompleted = getIsJobJustCompleted(
        jobBeforeUpdate.status as JobStatus,
        updatedJob.status as JobStatus,
      );
      if (!isJobJustCompleted) return null;

      const releaseTargetResult = await getReleaseTarget(tx, jobId);
      if (releaseTargetResult == null) return null;
      const { release_target: releaseTarget } = releaseTargetResult;

      const matchedPolicies = await getMatchedPolicies(tx, releaseTarget);
      const isJobFailed = failedStatuses.includes(
        updatedJob.status as JobStatus,
      );
      const firstRetryPolicy = matchedPolicies.find(
        (p) => p.retry != null,
      )?.retry;
      const numRetryAttempts = await getNumRetryAttempts(tx, jobId);
      const shouldRetry =
        isJobFailed &&
        firstRetryPolicy != null &&
        numRetryAttempts < firstRetryPolicy.maxRetries;

      if (shouldRetry) {
        await retryJob(tx, jobId);
        return null;
      }

      await dispatchQueueJob().toEvaluate().releaseTargets([releaseTarget]);

      return updatedJob;
    });

    if (job?.status === JobStatus.Successful)
      await triggerDependentTargets(job);
  } catch (e: any) {
    const isRowLocked = e.code === "55P03";
    if (isRowLocked) {
      getQueue(Channel.UpdateJob).add(jobId, job.data);
      return;
    }

    log.error("Failed to update job", { error: e });
    throw e;
  }
});
