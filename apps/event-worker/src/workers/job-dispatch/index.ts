import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { JobAgentType } from "@ctrlplane/validators/jobs";

import { dispatchGithubJob } from "./github.js";

const log = logger.child({ module: "job-dispatch-worker" });

export const dispatchJobWorker = createWorker(
  Channel.DispatchJob,
  async (queueJob) => {
    const { data } = queueJob;
    const { jobId } = data;

    log.info(`Processing job ${jobId} in the dispatch worker`);

    const job = await db.query.job.findFirst({
      where: eq(schema.job.id, jobId),
      with: { agent: true },
    });

    if (job == null) {
      log.error(`Job ${jobId} not found`);
      queueJob.log(`Job ${jobId} not found`);
      return;
    }

    const { agent } = job;
    if (agent == null) {
      log.error(`Job ${jobId} has no agent`);
      queueJob.log(`Job ${jobId} has no agent`);
      return;
    }

    if (agent.type === String(JobAgentType.GithubApp)) {
      log.info(`Dispatching job ${jobId} to GitHub app`);
      queueJob.log(`Dispatching job ${jobId} to GitHub app`);
      await dispatchGithubJob(job);
    }
  },
);
