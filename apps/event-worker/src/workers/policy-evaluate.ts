import { and, desc, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { evaluate, getReleasesFromDb } from "@ctrlplane/rule-engine";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { exitedStatus } from "@ctrlplane/validators/jobs";

import { createJobFromRelease } from "../releases/create-job-from-release.js";
import { ReleaseRepositoryMutex } from "../releases/mutex.js";

const getLastDeployedRelease = async (releaseTargetId: string) => {
  const lastDeployedJob = await db
    .select()
    .from(schema.job)
    .innerJoin(schema.releaseJob, eq(schema.job.id, schema.releaseJob.jobId))
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(schema.release.releaseTargetId, schema.releaseTarget.id),
    )
    .where(
      and(
        eq(schema.releaseTarget.id, releaseTargetId),
        inArray(schema.job.status, exitedStatus),
      ),
    )
    .orderBy(desc(schema.job.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  return lastDeployedJob?.release ?? null;
};

/**
 * Worker that evaluates policies for a release target and creates a job if a
 * release passes the policies.
 *
 * When triggered:
 * 1. Finds the release target and associated resource, environment, and
 *    deployment
 * 2. Acquires a mutex lock to prevent concurrent modifications
 * 3. Gets applicable policies for the workspace and release target
 * 4. Evaluates the policies against the release target
 * 5. If a release passes policies and hasn't been deployed yet:
 *    - Creates a new job for the release
 *    - Dispatches the job for execution
 */
export const policyEvaluateWorker = createWorker(
  Channel.PolicyEvaluate,
  async (job) => {
    const releaseRepo = job.data;
    const mutex = await ReleaseRepositoryMutex.lock(releaseRepo);

    try {
      const releaseTarget = await db.query.releaseTarget.findFirst({
        where: eq(schema.releaseTarget.resourceId, releaseRepo.resourceId),
        with: {
          resource: true,
          environment: true,
          deployment: true,
        },
      });

      if (releaseTarget == null) {
        job.log(
          `Release target for resource ${releaseRepo.resourceId} not found`,
        );
        return;
      }

      if (releaseTarget.resource.deletedAt != null) {
        job.log(`Resource ${releaseTarget.resource.id} has been deleted`);
        return;
      }

      const policies = await getApplicablePolicies(
        db,
        releaseTarget.resource.workspaceId,
        releaseRepo,
      );

      const getReleases = getReleasesFromDb(db);
      const result = await evaluate(policies, releaseTarget, getReleases);
      if (result.chosenRelease == null) {
        job.log(`No passing releases found.`);
        return;
      }

      const { chosenRelease } = result;
      const release = await db.query.release.findFirst({
        where: eq(schema.release.id, chosenRelease.id),
        with: { jobs: true },
      });
      if (release == null) {
        job.log(`Release ${chosenRelease.id} not found`);
        return;
      }

      const lastDeployedRelease = await getLastDeployedRelease(
        releaseTarget.id,
      );
      if (lastDeployedRelease?.id === release.id) {
        job.log(
          `Release ${chosenRelease.id} is the same as the last deployed release`,
        );
        return;
      }

      const dbJob = await createJobFromRelease(release);
      if (dbJob == null) {
        job.log(`Failed to create job for release ${chosenRelease.id}`);
        return;
      }

      getQueue(Channel.DispatchJob).add(dbJob.id, { jobId: dbJob.id });
    } finally {
      await mutex.unlock();
    }
  },
);
