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

export const createAndAcquireMutex = async (
  type: SelectorComputeType,
  workspaceId: string,
) => {
  const mutex = new SelectorComputeMutex(type, workspaceId);
  await mutex.lock();
  return mutex;
};

export class SelectorComputeMutex {
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

  async lock() {
    if (this.mutex.isAcquired) throw new Error("Mutex is already locked");
    return this.mutex.acquire();
  }

  async unlock() {
    if (!this.mutex.isAcquired) throw new Error("Mutex is not locked");
    return this.mutex.release();
  }
}
