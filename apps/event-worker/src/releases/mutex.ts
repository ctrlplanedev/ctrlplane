import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import ms from "ms";
import { Mutex as RedisMutex } from "redis-semaphore";

import { logger } from "@ctrlplane/logger";

import { redis } from "../redis.js";

const log = logger.child({
  module: "release-target-mutex",
});

export class ReleaseTargetMutex {
  static async lock(releaseTargetIdentifier: ReleaseTargetIdentifier) {
    const mutex = new ReleaseTargetMutex(releaseTargetIdentifier);
    await mutex.lock();
    return mutex;
  }

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
