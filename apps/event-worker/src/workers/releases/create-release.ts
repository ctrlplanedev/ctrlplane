import type { ReleaseRepository } from "@ctrlplane/rule-engine";
import { Queue } from "bullmq";

import { ReleaseManager } from "@ctrlplane/release-manager";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../../redis.js";
import { ReleaseRepositoryMutex } from "./mutex.js";

const evaluate = new Queue(Channel.ReleaseEvaluate, {
  connection: redis,
});

export const createAndEvaluateRelease = async (
  repo: ReleaseRepository,
  versionId?: string,
) => {
  // Acquire mutex lock to prevent concurrent modifications
  const mutex = await ReleaseRepositoryMutex.lock(repo);
  try {
    const releaseManager = await ReleaseManager.usingDatabase(repo);
    const { created, release } =
      versionId == null
        ? await releaseManager.upsertVariableRelease()
        : await releaseManager.upsertVersionRelease(versionId);

    if (!created) return;

    // For now we are just always going to set the release as desired, even if
    // there is a channel attached policy. We can revisit this in the future if
    // it causes issues.
    await releaseManager.setDesiredRelease(release.id);

    await evaluate.add(release.id, repo);
  } finally {
    // Always release the mutex lock
    await mutex.unlock();
  }
};
