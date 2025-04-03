import type { Job, WorkerOptions } from "bullmq";
import { Queue, Worker } from "bullmq";

import type { ChannelMap } from "./types.js";
import { bullmqRedis } from "./redis.js";

export const createWorker = <T extends keyof ChannelMap>(
  name: T,
  handler: (job: Job<ChannelMap[T]>) => Promise<void>,
  opts?: WorkerOptions,
) =>
  new Worker(String(name), handler, {
    connection: bullmqRedis,
    removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
    removeOnFail: { age: 12 * 60 * 60, count: 5000 },
    concurrency: 100,
    autorun: true,
    ...opts,
  });

const _queues = new Map<keyof ChannelMap, Queue>();
export const getQueue = <T extends keyof ChannelMap>(name: T) => {
  if (!_queues.has(name))
    _queues.set(name, new Queue(String(name), { connection: bullmqRedis }));

  return _queues.get(name) as Queue<ChannelMap[T]>;
};

export * from "./types.js";
export * from "./redis.js";
