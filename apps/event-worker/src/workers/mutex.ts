import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";
import type { Mutex as RedisMutex } from "redis-semaphore";
import { Mutex as RedisSemaphoreMutex } from "redis-semaphore";

import { redis } from "../redis.js";

export class ReleaseRepositoryMutex {
  static async lock(repo: ReleaseTargetIdentifier) {
    const mutex = new ReleaseRepositoryMutex(repo);
    await mutex.lock();
    return mutex;
  }

  private mutex: RedisMutex;

  constructor(releaseTargetIdentifier: ReleaseTargetIdentifier) {
    const key = `release-repository-mutex-${releaseTargetIdentifier.deploymentId}-${releaseTargetIdentifier.resourceId}-${releaseTargetIdentifier.environmentId}`;
    this.mutex = new RedisSemaphoreMutex(redis, key, {});
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
