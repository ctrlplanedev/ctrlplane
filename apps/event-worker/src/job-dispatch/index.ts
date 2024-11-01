import type { DispatchJobEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
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

          try {
            job.log(
              `Dispatching job ${je.job.id} --- ${je.job_agent.type}/${je.job_agent.name}`,
            );
            if (je.job_agent.type === String(JobAgentType.GithubApp)) {
              job.log(`Dispatching to GitHub app`);
              await dispatchGithubJob(je.job);
            }
          } catch (error: unknown) {
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
      removeOnComplete: { age: 1 * 60 * 60, count: 100 },
      removeOnFail: { age: 12 * 60 * 60, count: 100 },
      concurrency: 10,
    },
  );
