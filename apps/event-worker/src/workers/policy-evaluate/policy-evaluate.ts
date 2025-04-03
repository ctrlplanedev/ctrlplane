import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { ReleaseManager } from "@ctrlplane/release-manager";
import { evaluate, getReleasesFromDb } from "@ctrlplane/rule-engine";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";

import { ReleaseRepositoryMutex } from "./mutex.js";

/**
 * We assume that the resource has already been validated to have a release
 * target.
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
