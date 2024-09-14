import type { JobExecution } from "@ctrlplane/db/schema";
import type { DispatchJobExecutionEvent } from "@ctrlplane/validators/events";
import type { Job } from "bullmq";
import { Queue, Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel } from "@ctrlplane/validators/events";
import { JobAgentType, JobExecutionStatus } from "@ctrlplane/validators/jobs";

import { redis } from "../redis.js";
import { syncGithubJobExecution } from "./github.js";

const jobExecutionSyncQueue = new Queue(Channel.JobExecutionSync, {
  connection: redis,
});
const removeJobExecutionSyncJob = (job: Job) =>
  job.repeatJobKey != null
    ? jobExecutionSyncQueue.removeRepeatableByKey(job.repeatJobKey)
    : null;

type SyncFunction = (je: JobExecution) => Promise<boolean | undefined>;

const getSyncFunction = (agentType: string): SyncFunction | null => {
  if (agentType === String(JobAgentType.GithubApp))
    return syncGithubJobExecution;
  return null;
};

export const createJobExecutionSyncWorker = () =>
  new Worker<DispatchJobExecutionEvent>(
    Channel.JobExecutionSync,
    (job) =>
      db
        .select()
        .from(schema.job)
        .innerJoin(
          schema.jobAgent,
          eq(schema.job.jobAgentId, schema.jobAgent.id),
        )
        .where(eq(schema.job.id, job.data.jobExecutionId))
        .then(takeFirstOrNull)
        .then((je) => {
          if (je == null) return;

          const syncFunction = getSyncFunction(je.job_agent.type);
          if (syncFunction == null) return;

          try {
            syncFunction(je.job).then(
              (isCompleted) => isCompleted && removeJobExecutionSyncJob(job),
            );
          } catch (error) {
            db.update(schema.job).set({
              status: JobExecutionStatus.Failure,
              message: (error as Error).message,
            });
          }
        }),
    {
      connection: redis,
      removeOnComplete: { age: 0, count: 0 },
      removeOnFail: { age: 0, count: 0 },
      concurrency: 10,
    },
  );
