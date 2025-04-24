import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import { trace } from "@opentelemetry/api";
import ms from "ms";
import { Mutex as RedisMutex } from "redis-semaphore";

import { logger, makeWithSpan } from "@ctrlplane/logger";

import { redis } from "../redis.js";
import { getReleaseTargetLockKey } from "../utils/lock-key.js";

const log = logger.child({ module: "release-target-mutex" });
const tracer = trace.getTracer("release-target-mutex");
const withSpan = makeWithSpan(tracer);

export const createAndAcquireMutex = withSpan(
  "createAndAcquireMutex",
  async (
    span,
    releaseTargetIdentifier: ReleaseTargetIdentifier,
    opts = { tryLock: false },
  ) => {
    span.setAttribute("environment.id", releaseTargetIdentifier.environmentId);
    span.setAttribute("deployment.id", releaseTargetIdentifier.deploymentId);
    span.setAttribute("resource.id", releaseTargetIdentifier.resourceId);

    const mutex = new ReleaseTargetMutex(releaseTargetIdentifier);
    if (opts.tryLock) return [mutex, await mutex.tryLock()] as const;

    await mutex.lock();
    return [mutex, true] as const;
  },
);

class ReleaseTargetMutex {
  private readonly key: string;
  private mutex: RedisMutex;

  constructor(releaseTargetIdentifier: ReleaseTargetIdentifier) {
    this.key = getReleaseTargetLockKey(releaseTargetIdentifier);
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

  async tryLock(): Promise<boolean> {
    if (this.mutex.isAcquired) return false;
    try {
      await this.mutex.tryAcquire();
      return true;
    } catch {
      return false;
    }
  }

  // Regular lock that waits to acquire
  lock(): Promise<void> {
    if (this.mutex.isAcquired) throw new Error("Mutex is already locked");
    return this.mutex.acquire();
  }

  unlock(): Promise<void> {
    if (!this.mutex.isAcquired) throw new Error("Mutex is not locked");
    return this.mutex.release();
  }
}
