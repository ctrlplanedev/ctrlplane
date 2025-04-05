import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import { Mutex as RedisMutex } from "redis-semaphore";

import { redis } from "../redis.js";

export class ReleaseTargetMutex {
  static async lock(releaseTargetIdentifier: ReleaseTargetIdentifier) {
    const mutex = new ReleaseTargetMutex(releaseTargetIdentifier);
    await mutex.lock();
    return mutex;
  }

  private mutex: RedisMutex;

  constructor(releaseTargetIdentifier: ReleaseTargetIdentifier) {
    const key = `release-target-mutex-${releaseTargetIdentifier.deploymentId}-${releaseTargetIdentifier.resourceId}-${releaseTargetIdentifier.environmentId}`;
    this.mutex = new RedisMutex(redis, key, {});
  }

  async lock(): Promise<void> {
    if (this.mutex.isAcquired) throw new Error("Mutex is already locked");
    await this.mutex.acquire();
  }

  async unlock(): Promise<void> {
    if (!this.mutex.isAcquired) throw new Error("Mutex is not locked");
    await this.mutex.release();
  }
}
