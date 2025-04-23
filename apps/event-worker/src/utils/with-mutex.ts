import { Mutex as RedisMutex } from "redis-semaphore";

import { redis } from "../redis.js";

export const withMutex = async <T>(
  key: string,
  fn: (mutex: RedisMutex) => Promise<T> | T,
  opts: { tryAcquire: boolean } = { tryAcquire: false },
): Promise<[boolean, T | null]> => {
  const mutex = new RedisMutex(redis, key);

  try {
    if (opts.tryAcquire) {
      const acquired = await mutex.tryAcquire();
      if (!acquired) return [false, null];
    } else {
      await mutex.acquire();
    }

    const result = await fn(mutex);
    return [true, result];
  } catch (error) {
    console.error("Error executing mutex function", { error, key });
    throw error;
  } finally {
    await mutex.release();
  }
};
