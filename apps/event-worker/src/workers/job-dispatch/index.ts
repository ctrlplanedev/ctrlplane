import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { updateJob } from "@ctrlplane/job-dispatch";
import { JobAgentType, JobStatus } from "@ctrlplane/validators/jobs";

import { dispatchGithubJob } from "./github.js";

export const dispatchJobWorker = createWorker(
  Channel.DispatchJob,
  async (queueJob) => {
    const { data } = queueJob;
    const { jobId } = data;

    const job = await db.query.job.findFirst({
      where: eq(schema.job.id, jobId),
      with: { agent: true },
    });

    if (job == null) {
      queueJob.log(`Job ${jobId} not found`);
      return;
    }

    const { agent } = job;
    if (agent == null) {
      queueJob.log(`Job ${jobId} has no agent`);
      updateJob(db, job.id, {
        status: JobStatus.InvalidJobAgent,
        message: `Job has no agent`,
      });
      return;
    }

    if (agent.type === String(JobAgentType.GithubApp)) {
      queueJob.log(`Dispatching job ${jobId} to GitHub app`);
      try {
        await dispatchGithubJob(job);
      } catch (error: any) {
        await updateJob(db, job.id, {
          status: JobStatus.InvalidIntegration,
          message: `Error dispatching job to GitHub app: ${error}`,
        });
        throw error;
      }
    }
  },
);
