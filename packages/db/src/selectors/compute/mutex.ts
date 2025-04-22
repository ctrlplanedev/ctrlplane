import ms from "ms";
import { Mutex as RedisMutex } from "redis-semaphore";

import { logger } from "@ctrlplane/logger";

import { redis } from "../../redis.js";

const log = logger.child({ module: "selector-compute-mutex" });

export enum SelectorComputeType {
  ResourceBuilder = "resource-builder",
  EnvironmentBuilder = "environment-builder",
  DeploymentBuilder = "deployment-builder",
  PolicyBuilder = "policy-builder",
}

const createAndAcquireMutex = async (
  type: SelectorComputeType,
  workspaceId: string,
  opts = { tryLock: false },
) => {
  const mutex = new SelectorComputeMutex(type, workspaceId);
  if (opts.tryLock) return [mutex, await mutex.tryLock()] as const;
  await mutex.lock();
  return [mutex, true] as const;
};

class SelectorComputeMutex {
  private readonly key: string;
  private mutex: RedisMutex;

  constructor(type: SelectorComputeType, workspaceId: string) {
    this.key = `${type}-${workspaceId}`;
    this.mutex = new RedisMutex(redis, this.key, {
      lockTimeout: ms("30s"),
      acquireTimeout: ms("30s"),
      onLockLost: (e) =>
        log.warning("Lock lost for selector compute", {
          error: e,
          type,
          workspaceId,
        }),
    });
  }

  get isAcquired() {
    return this.mutex.isAcquired;
  }

  tryLock() {
    return this.mutex.tryAcquire();
  }

  lock() {
    if (this.mutex.isAcquired) throw new Error("Mutex is already locked");
    return this.mutex.acquire();
  }

  unlock() {
    if (!this.mutex.isAcquired) throw new Error("Mutex is not locked");
    return this.mutex.release();
  }
}

/**
 * Helper function to execute code with a mutex lock
 * @param type - Type of selector compute mutex
 * @param workspaceId - ID of workspace to lock
 * @param fn - Function to execute while holding lock
 * @returns Result of executed function
 */
export const withMutex = async <T>(
  type: SelectorComputeType,
  workspaceId: string,
  fn: () => Promise<T> | T,
): Promise<T> => {
  const [mutex] = await createAndAcquireMutex(type, workspaceId);
  if (!mutex.isAcquired) {
    throw new Error("Mutex is not acquired");
  }

  log.info("Mutex acquired", { workspaceId, type });
  try {
    return await fn();
  } catch (error) {
    console.error(error);
    throw error;
  } finally {
    await mutex.unlock();
    log.info("Mutex released", { workspaceId, type });
  }
};
