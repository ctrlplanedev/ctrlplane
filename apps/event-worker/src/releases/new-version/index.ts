import type { ReleaseRepository } from "@ctrlplane/rule-engine";
import type { ReleaseNewVersionEvent } from "@ctrlplane/validators/events";
import { Queue, Worker } from "bullmq";
import _ from "lodash";

import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { ReleaseManager } from "@ctrlplane/release-manager";
import { Channel } from "@ctrlplane/validators/events";

import { redis } from "../../redis.js";
import { ReleaseRepositoryMutex } from "../mutex.js";
import { getSystemResources } from "./system-resources.js";

const evaluate = new Queue(Channel.ReleaseEvaluate, {
  connection: redis,
});

/**
 * Handles creating and updating releases for a specific repository and version
 *
 * @param repo - The release repository to handle
 * @param versionId - ID of the version to create/update release for
 */
const handleReleaseRepo = async (
  repo: ReleaseRepository,
  versionId: string,
) => {
  // Acquire mutex lock to prevent concurrent modifications
  const mutex = await ReleaseRepositoryMutex.lock(repo);
  try {
    const releaseManager = await ReleaseManager.usingDatabase(repo);
    const { created, release } =
      await releaseManager.upsertVersionRelease(versionId);

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

export const createReleaseNewVersionWorker = () =>
  new Worker<ReleaseNewVersionEvent>(
    Channel.ReleaseNewVersion,
    async (job) => {
      const version = await db.query.deploymentVersion.findFirst({
        where: eq(schema.deploymentVersion.id, job.data.versionId),
        with: { deployment: true },
      });

      if (version == null) throw new Error("Version not found");

      const { deployment } = version;
      const { systemId } = deployment;

      const impactedResources = await getSystemResources(db, systemId);
      const releaseRepos: ReleaseRepository[] = impactedResources.map((r) => ({
        deploymentId: deployment.id,
        resourceId: r.id,
        environmentId: r.environment.id,
      }));

      job.log(`Creating ${releaseRepos.length} releases`);
      await Promise.allSettled(
        releaseRepos.map((repo) => handleReleaseRepo(repo, version.id)),
      );
      job.log(`Created ${releaseRepos.length} releases`);
    },
    {
      connection: redis,
      removeOnComplete: { age: 1 * 60 * 60, count: 5000 },
      removeOnFail: { age: 12 * 60 * 60, count: 5000 },
      concurrency: 100,
    },
  );
