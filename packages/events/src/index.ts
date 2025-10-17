import type { Job, WorkerOptions } from "bullmq";
import { Queue, Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";

import { logger } from "@ctrlplane/logger";

import type { EventDispatcher } from "./event-dispatcher.js";
import type { ChannelMap } from "./types.js";
import { KafkaEventDispatcher } from "./kafka/index.js";
import { bullmqRedis } from "./redis.js";

export const createWorker = <T extends keyof ChannelMap>(
  name: T,
  handler: (job: Job<ChannelMap[T]>) => Promise<void>,
  opts?: Partial<WorkerOptions>,
) => {
  logger.info(`Creating worker ${name}`);

  return new Worker(String(name), handler, {
    connection: bullmqRedis,
    removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
    removeOnFail: { age: 12 * 60 * 60, count: 5000 },
    concurrency: 5,
    telemetry: new BullMQOtel("ctrlplane/event-worker"),
    ...opts,
  });
};

const _queues = new Map<keyof ChannelMap, Queue>();
export const getQueue = <T extends keyof ChannelMap>(name: T) => {
  if (!_queues.has(name)) {
    _queues.set(name, new Queue(String(name), { connection: bullmqRedis }));
  }

  return _queues.get(name) as Queue<ChannelMap[T]>;
};

export * from "./types.js";
export * from "./redis.js";
export * from "./resource-provider-scan/handle-provider-scan.js";
export * from "./dispatch-jobs.js";
export * from "./kafka/index.js";

export const eventDispatcher: EventDispatcher = new KafkaEventDispatcher();
