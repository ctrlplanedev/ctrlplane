import { eq, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { dispatchJobUpdated } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { JobAgentType, JobStatus } from "@ctrlplane/validators/jobs";

const log = logger.child({ module: "job-dispatch" });

const getJobAgent = async (job: schema.Job) => {
  if (job.jobAgentId == null) return null;
  return db
    .select()
    .from(schema.jobAgent)
    .where(eq(schema.jobAgent.id, job.jobAgentId))
    .then(takeFirst);
};

const updateJobStatus = async (
  jobId: string,
  status: JobStatus,
  message: string,
) =>
  db
    .update(schema.job)
    .set({ status, message })
    .where(eq(schema.job.id, jobId))
    .returning()
    .then(takeFirst);

export const dispatchJob = async (job: schema.Job, workspaceId: string) => {
  const jobAgent = await getJobAgent(job);
  if (jobAgent == null) {
    log.info(`Job ${job.id} has no job agent, skipping dispatch`);
    const updatedJob = await updateJobStatus(
      job.id,
      JobStatus.InvalidJobAgent,
      `Job has no job agent`,
    );

    await dispatchJobUpdated(job, updatedJob, workspaceId);
    return;
  }

  if (jobAgent.type === String(JobAgentType.GithubApp)) {
    log.info(`Dispatching job ${job.id} to GitHub app`);

    try {
      log.info(`Dispatching job ${job.id} to GitHub app`);
    } catch (error: any) {
      log.error(`Error dispatching job ${job.id} to GitHub app`, {
        error: error.message,
      });

      const updatedJob = await updateJobStatus(
        job.id,
        JobStatus.InvalidIntegration,
        `Error dispatching job to GitHub app: ${error.message}`,
      );

      await dispatchJobUpdated(job, updatedJob, workspaceId);
    }
  }
};
