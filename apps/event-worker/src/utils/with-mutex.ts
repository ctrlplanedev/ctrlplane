import { Mutex as RedisMutex } from "redis-semaphore";

import { redis } from "../redis.js";

/**
 * Options for configuring the mutex behavior
 */
type MutexOptions = {
  /**
   * Optional function that returns an array of dependent lock keys that should
   * be acquired after the primary lock. This enables atomic operations across
   * multiple related resources.
   */
  getDependentLockKeys?: () => Promise<string[]> | string[];
};

/**
 * Executes a function within a distributed mutex lock context, with support for
 * dependent locks. This implements a "Dependent Lock Chain" pattern where a
 * primary lock is acquired first, followed by any dependent resource locks.
 *
 * @example
 * ```typescript
 * // Simple usage with single lock
 * const [acquired, result] = await withMutex('user-123', async () => {
 *   return await updateUser(123);
 * });
 *
 * // Usage with dependent locks
 * const [acquired, result] = await withMutex('user-123',
 *   async () => {
 *     return await updateUserAndPreferences(123);
 *   },
 *   {
 *     getDependentLockKeys: async () => ['user-123-preferences', 'user-123-settings']
 *   }
 * );
 * ```
 *
 * @param key - The primary lock key to acquire
 * @param fn - The function to execute while holding the lock(s)
 * @param opts - Optional configuration for dependent locks
 *
 * @returns A tuple containing: - boolean: Whether all locks were successfully
 *          acquired - T | null: The result of the function execution if locks
 *          were acquired, null otherwise
 *
 * @throws Will throw any errors that occur during the execution of the provided
 * function
 *
 * Key Features:
 * - Implements all-or-nothing lock acquisition
 * - Proper lock ordering to prevent deadlocks
 * - LIFO (Last In, First Out) lock release
 * - Automatic cleanup of locks in finally block
 */
export const withMutex = async <T>(
  key: string,
  fn: (mutex: RedisMutex) => Promise<T> | T,
  opts: MutexOptions = {},
): Promise<[boolean, T | null]> => {
  const primaryMutex = new RedisMutex(redis, key);
  let dependentMutexes: RedisMutex[] = [];

  try {
    // Try to acquire the primary lock first
    const acquired = await primaryMutex.tryAcquire();
    if (!acquired) return [false, null];

    // Get dependent locks if function provided
    if (opts.getDependentLockKeys) {
      const dependentLockKeys = await opts.getDependentLockKeys();
      dependentMutexes = dependentLockKeys.map((k) => new RedisMutex(redis, k));

      // Try to acquire all dependent locks
      const acquiredLocks = await Promise.all(
        dependentMutexes.map((m) => m.tryAcquire()),
      );

      // If any dependent lock couldn't be acquired, release primary and return
      if (acquiredLocks.some((acquired) => !acquired)) {
        await primaryMutex.release();
        return [false, null];
      }
    }

    const result = await fn(primaryMutex);
    return [true, result];
  } catch (error) {
    console.error("Error executing mutex function", { error, key });
    throw error;
  } finally {
    // Release all locks in reverse order
    await Promise.all(dependentMutexes.map((m) => m.release()));
    await primaryMutex.release();
  }
};
