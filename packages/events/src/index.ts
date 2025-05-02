import type { Job, WorkerOptions } from "bullmq";
import { Queue, Worker } from "bullmq";
import { BullMQOtel } from "bullmq-otel";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";

import type { ChannelMap } from "./types.js";
import { bullmqRedis } from "./redis.js";
import { Channel } from "./types.js";

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

export const queueEvaluateReleaseTarget = async (
  value: ChannelMap[Channel.EvaluateReleaseTarget],
) => {
  const q = getQueue(Channel.EvaluateReleaseTarget);
  const exists =
    (await q.getWaiting()).filter((t) =>
      _.isEqual(
        _.pick(value, [
          "environmentId",
          "resourceId",
          "deploymentId",
          "skipDuplicateCheck",
        ]),
        _.pick(t.data, [
          "environmentId",
          "resourceId",
          "deploymentId",
          "skipDuplicateCheck",
        ]),
      ),
    ).length > 0;

  if (exists) return;

  return q.add(
    `${value.environmentId}-${value.resourceId}-${value.deploymentId}`,
    value,
  );
};
