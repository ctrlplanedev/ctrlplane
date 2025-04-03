import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { updateJob } from "@ctrlplane/job-dispatch";
import { JobAgentType, JobStatus } from "@ctrlplane/validators/jobs";

import { dispatchGithubJob } from "./github.js";

export const dispatchJobWorker = createWorker(
  Channel.DispatchJob,
  async (job) => {
    const { jobId } = job.data;
    const je = await db
      .select()
      .from(schema.job)
      .innerJoin(schema.jobAgent, eq(schema.job.jobAgentId, schema.jobAgent.id))
      .where(eq(schema.job.id, jobId))
      .then(takeFirstOrNull);

    if (je == null) {
      job.log(`Job ${jobId} not found`);
      return;
    }

    try {
      job.log(
        `Dispatching job ${je.job.id} --- ${je.job_agent.type}/${je.job_agent.name}`,
      );
      if (je.job_agent.type === String(JobAgentType.GithubApp)) {
        job.log(`Dispatching to GitHub app`);
        await dispatchGithubJob(je.job);
      }
    } catch (error: unknown) {
      await updateJob(db, je.job.id, {
        status: JobStatus.Failure,
        message: (error as Error).message,
      });
    }
  },
);
