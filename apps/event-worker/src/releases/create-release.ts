import type { ReleaseRepository } from "@ctrlplane/rule-engine";

import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { ReleaseManager } from "@ctrlplane/release-manager";

import { ReleaseRepositoryMutex } from "./mutex.js";

const policyEvaluateQueue = getQueue(Channel.PolicyEvaluate);

const createReleaseWithLock = async (
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

    await policyEvaluateQueue.add(release.id, repo);
  } finally {
    // Always release the mutex lock
    await mutex.unlock();
  }
};

export const createReleases = async (
  releaseTargets: (typeof schema.releaseTarget.$inferInsert & {
    versionId?: string;
  })[],
) => {
  // First upsert all release targets
  await db
    .insert(schema.releaseTarget)
    .values(releaseTargets)
    .onConflictDoNothing();

  // Create releases and evaluate for each target
  await Promise.all(
    releaseTargets.map(async (target) => {
      const repo = {
        deploymentId: target.deploymentId,
        environmentId: target.environmentId,
        resourceId: target.resourceId,
      };

      await createReleaseWithLock(repo, target.versionId);
    }),
  );
};
