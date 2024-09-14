import type { Tx } from "@ctrlplane/db";

import { and, eq, isNotNull, or, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";

import { determineVariablesForReleaseJob } from "./job-variables-deployment.js";

export const createVariables = async (tx: Tx, jobId: string): Promise<void> => {
  // Fetch the job and its associated deployment
  const job = await tx
    .select()
    .from(SCHEMA.job)
    .leftJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
    )
    .leftJoin(
      SCHEMA.runbookJobTrigger,
      eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
    )
    .where(
      and(
        eq(SCHEMA.job.id, jobId),
        or(
          isNotNull(SCHEMA.runbookJobTrigger),
          isNotNull(SCHEMA.releaseJobTrigger),
        ),
      ),
    )
    .then(takeFirstOrNull);

  if (job == null) throw new Error(`Job with id ${jobId} not found`);

  const jobVariables: SCHEMA.JobVariable[] =
    job.release_job_trigger != null
      ? await determineVariablesForReleaseJob(tx, {
          ...job.job,
          releaseJobTrigger: job.release_job_trigger,
        })
      : job.runbook_job_trigger != null
        ? await determineVariablesForRunbookJob(tx)
        : [];

  if (jobVariables.length > 0)
    await tx.insert(SCHEMA.jobVariable).values(jobVariables);
};

const determineVariablesForRunbookJob = async (
  _: Tx,
  // eslint-disable-next-line @typescript-eslint/require-await
): Promise<SCHEMA.JobVariable[]> => {
  throw new Error("not implemented");
};
