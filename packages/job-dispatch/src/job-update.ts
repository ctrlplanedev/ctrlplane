import type * as schema from "@ctrlplane/db/schema";
import type { JobUpdateEvent } from "@ctrlplane/validators/events";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import { Queue } from "bullmq";
import IORedis from "ioredis";

import { Channel } from "@ctrlplane/validators/events";

import { env } from "./config.js";

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
export const jobUpdateQueue = new Queue<JobUpdateEvent>(Channel.JobUpdate, {
  connection,
});

export const updateJob = async (
  jobId: string,
  updates: schema.UpdateJob,
  metadata?: Record<string, any>,
) => {
  const status = updates.status as JobStatus | undefined;
  const data = { ...updates, status };
  await jobUpdateQueue.add(jobId, { jobId, data, metadata });
};
