import type { JobUpdateEvent } from "@ctrlplane/validators/events";
import { Worker } from "bullmq";

import { db } from "@ctrlplane/db/client";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../redis.js";
import { updateJob } from "./update.js";

export const createJobUpdateWorker = () =>
  new Worker<JobUpdateEvent>(
    Channel.JobUpdate,
    async (queueJob) => {
      const { jobId, data, metadata } = queueJob.data;

      console.log("consumed job update event", jobId, data, metadata);

      await db.transaction((tx) => updateJob(tx, jobId, data, metadata));
    },
    {
      connection: redis,
      removeOnComplete: { count: 0 },
      removeOnFail: { count: 0 },
    },
  );
