import {
  Mutex as RedisMutex,
  Semaphore as RedisSemaphore,
} from "redis-semaphore";

import { redis } from "./redis.js";

export class SystemReleaseTargetsConcurrencyManager {
  private readonly computationKey: string;
  private computationMutex: RedisMutex;

  private readonly evaluationsKey: string;
  private evaluationsSemaphore: RedisSemaphore;

  constructor(systemId: string) {
    this.computationKey = `system-release-targets-computation-${systemId}`;
    this.evaluationsKey = `system-release-targets-evaluations-${systemId}`;

    this.computationMutex = new RedisMutex(redis, this.computationKey);
    this.evaluationsSemaphore = new RedisSemaphore(
      redis,
      this.evaluationsKey,
      10,
    );
  }

  private async isComputationRunning(): Promise<boolean> {
    const result = await redis.exists(this.computationKey);
    return result !== 0;
  }

  private async isEvaluationRunning(): Promise<boolean> {
    const result = await redis.zcard(this.evaluationsKey);
    return result !== 0;
  }

  async tryLockComputation(): Promise<boolean> {
    const isEvaluationRunning = await this.isEvaluationRunning();
    if (isEvaluationRunning) return false;
    try {
      await this.computationMutex.tryAcquire();
      return true;
    } catch {
      return false;
    }
  }

  async unlockComputation(): Promise<void> {
    if (!this.computationMutex.isAcquired) {
      throw new Error("This instance does not hold the computation mutex");
    }
    await this.computationMutex.release();
  }

  async tryLockEvaluation(): Promise<boolean> {
    const isComputationRunning = await this.isComputationRunning();
    if (isComputationRunning) return false;
    try {
      await this.evaluationsSemaphore.tryAcquire();
      return true;
    } catch {
      return false;
    }
  }

  async unlockEvaluation(): Promise<void> {
    if (!this.evaluationsSemaphore.isAcquired) {
      throw new Error("This instance does not hold the evaluation semaphore");
    }
    await this.evaluationsSemaphore.release();
  }
}
