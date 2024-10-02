import type { DispatchJobEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { Channel } from "@ctrlplane/validators/events";
import { JobAgentType, JobStatus } from "@ctrlplane/validators/jobs";

import { redis } from "../redis.js";
import { dispatchGithubJob } from "./github.js";

export const createDispatchExecutionJobWorker = () =>
  new Worker<DispatchJobEvent>(
    Channel.DispatchJob,
    (job) =>
      db
        .select()
        .from(schema.job)
        .innerJoin(
          schema.jobAgent,
          eq(schema.job.jobAgentId, schema.jobAgent.id),
        )
        .where(eq(schema.job.id, job.data.jobId))
        .then(takeFirstOrNull)
        .then(async (je) => {
          if (je == null) return;

          logger.info(`Dispatching job ${je.job.id}...`);

          try {
            if (je.job_agent.type === String(JobAgentType.GithubApp))
              await dispatchGithubJob(je.job);
          } catch (error) {
            db.update(schema.job)
              .set({
                status: JobStatus.Failure,
                message: (error as Error).message,
              })
              .where(eq(schema.job.id, je.job.id));
          }
        }),
    {
      connection: redis,
      removeOnComplete: { age: 0, count: 0 },
      removeOnFail: { age: 0, count: 0 },
      concurrency: 10,
    },
  );
