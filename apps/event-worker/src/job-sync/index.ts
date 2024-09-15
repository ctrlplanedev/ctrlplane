import type { Job } from "@ctrlplane/db/schema";
import type { DispatchJobEvent } from "@ctrlplane/validators/events";
import type { Job as JobMq } from "bullmq";
import { Queue, Worker } from "bullmq";

import { eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { onJobCompletion } from "@ctrlplane/job-dispatch";
import { Channel } from "@ctrlplane/validators/events";
import { JobAgentType, JobStatus } from "@ctrlplane/validators/jobs";

import { redis } from "../redis.js";
import { syncGithubJob } from "./github.js";

const jobSyncQueue = new Queue(Channel.JobSync, {
  connection: redis,
});
const removeJobSyncJob = (job: JobMq) =>
  job.repeatJobKey != null
    ? jobSyncQueue.removeRepeatableByKey(job.repeatJobKey)
    : null;

type SyncFunction = (je: Job) => Promise<boolean | undefined>;

const getSyncFunction = (agentType: string): SyncFunction | null => {
  if (agentType === String(JobAgentType.GithubApp)) return syncGithubJob;
  return null;
};

export const createjobSyncWorker = () =>
  new Worker<DispatchJobEvent>(
    Channel.JobSync,
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
        .then((je) => {
          if (je == null) return;

          const syncFunction = getSyncFunction(je.job_agent.type);
          if (syncFunction == null) return;

          try {
            syncFunction(je.job).then(async (isCompleted) => {
              if (!isCompleted) return;
              removeJobSyncJob(job);
              await onJobCompletion(je.job);
            });
          } catch (error) {
            db.update(schema.job).set({
              status: JobStatus.Failure,
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
