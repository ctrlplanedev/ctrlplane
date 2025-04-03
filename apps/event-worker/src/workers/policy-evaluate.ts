import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { ReleaseManager } from "@ctrlplane/release-manager";
import { evaluate, getReleasesFromDb } from "@ctrlplane/rule-engine";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";

import { ReleaseRepositoryMutex } from "../releases/mutex.js";

/**
 * Worker that evaluates policies for a release target. When triggered:
 *
 * 1. Finds the release target and associated resource, environment, and
 *    deployment
 * 2. Acquires a mutex lock to prevent concurrent modifications
 * 3. Creates/updates a variable release and sets it as desired
 * 4. Gets applicable policies for the workspace and release target
 * 5. Evaluates the policies against the release target
 */
export const policyEvaluateWorker = createWorker(
  Channel.PolicyEvaluate,
  async (job) => {
    const releaseTarget = await db.query.releaseTarget.findFirst({
      where: eq(schema.releaseTarget.resourceId, job.data.resourceId),
      with: {
        resource: true,
        environment: true,
        deployment: true,
      },
    });

    if (releaseTarget == null) {
      job.log(`Release target for resource ${job.data.resourceId} not found`);
      return;
    }

    const mutex = await ReleaseRepositoryMutex.lock(releaseTarget);
    try {
      const manager = await ReleaseManager.usingDatabase(releaseTarget);
      await manager.upsertVariableRelease({ setAsDesired: true });

      const policies = await getApplicablePolicies(
        db,
        releaseTarget.resource.workspaceId,
        job.data,
      );

      const getReleases = getReleasesFromDb(db);
      const result = await evaluate(policies, releaseTarget, getReleases);

      console.log(result);
    } finally {
      await mutex.unlock();
    }
  },
);
