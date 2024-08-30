import type { DispatchJobExecutionEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { jobAgent, jobExecution } from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";
import { JobAgentType, JobExecutionStatus } from "@ctrlplane/validators/jobs";

import { redis } from "../redis.js";
import { dispatchGithubJobExecution } from "./github.js";

export const createDispatchExecutionJobWorker = () =>
  new Worker<DispatchJobExecutionEvent>(
    Channel.DispatchJobExecution,
    (job) =>
      db
        .select()
        .from(jobExecution)
        .innerJoin(jobAgent, eq(jobExecution.jobAgentId, jobAgent.id))
        .where(eq(jobExecution.id, job.data.jobExecutionId))
        .then(takeFirstOrNull)
        .then((je) => {
          if (je == null) return;

          try {
            if (je.job_agent.type === String(JobAgentType.GithubApp))
              dispatchGithubJobExecution(je.job_execution);
          } catch (error) {
            db.update(jobExecution)
              .set({
                status: JobExecutionStatus.Failure,
                message: (error as Error).message,
              })
              .where(eq(jobExecution.id, je.job_execution.id));
          }
        }),
    {
      connection: redis,
      removeOnComplete: { age: 0, count: 0 },
      removeOnFail: { age: 0, count: 0 },
      concurrency: 10,
    },
  );
