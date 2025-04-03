import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { createWorker } from "@ctrlplane/events";
import { Channel } from "@ctrlplane/validators/events";
import { JobAgentType } from "@ctrlplane/validators/jobs";

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
      return;
    }

    if (agent.type === String(JobAgentType.GithubApp)) {
      queueJob.log(`Dispatching job ${jobId} to GitHub app`);
      await dispatchGithubJob(job);
    }
  },
);
