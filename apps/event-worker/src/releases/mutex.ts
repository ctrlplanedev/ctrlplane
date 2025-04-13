import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import { trace } from "@opentelemetry/api";
import ms from "ms";
import { Mutex as RedisMutex } from "redis-semaphore";

import { logger } from "@ctrlplane/logger";

import { redis } from "../redis.js";
import { makeWithSpan } from "../utils/spans.js";

const log = logger.child({
  module: "release-target-mutex",
});

const tracer = trace.getTracer("release-target-mutex");
const withSpan = makeWithSpan(tracer);

export const createAndAcquireMutex = withSpan(
  "createAndAcquireMutex",
  async (span, releaseTargetIdentifier: ReleaseTargetIdentifier) => {
    span.setAttribute("environment.id", releaseTargetIdentifier.environmentId);
    span.setAttribute("deployment.id", releaseTargetIdentifier.deploymentId);
    span.setAttribute("resource.id", releaseTargetIdentifier.resourceId);

    const mutex = new ReleaseTargetMutex(releaseTargetIdentifier);
    await mutex.lock();
    return mutex;
  },
);

class ReleaseTargetMutex {
  private readonly key: string;
  private mutex: RedisMutex;

  constructor(releaseTargetIdentifier: ReleaseTargetIdentifier) {
    this.key = `release-target-mutex-${releaseTargetIdentifier.deploymentId}-${releaseTargetIdentifier.resourceId}-${releaseTargetIdentifier.environmentId}`;
    this.mutex = new RedisMutex(redis, this.key, {
      lockTimeout: ms("30s"),
      onLockLost: (e) => {
        log.warning("Lock lost for release target", {
          error: e,
          releaseTargetIdentifier,
        });
      },
    });
  }

  lock(): Promise<void> {
    log.info("Locking mutex", { key: this.key });
    if (this.mutex.isAcquired) throw new Error("Mutex is already locked");
    return this.mutex.acquire();
  }

  unlock(): Promise<void> {
    log.info("Unlocking mutex", { key: this.key });
    if (!this.mutex.isAcquired) throw new Error("Mutex is not locked");
    return this.mutex.release();
  }
}
