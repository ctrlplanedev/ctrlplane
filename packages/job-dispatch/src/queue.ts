import { Queue } from "bullmq";
import IORedis from "ioredis";

import { Channel } from "@ctrlplane/validators/events";

import { env } from "./config.js";

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

export const dispatchJobExecutionsQueue = new Queue(Channel.JobExecutionSync, {
  connection,
});
