import type { Tx } from "@ctrlplane/db";
import { isAfter } from "date-fns";

import { and, desc, eq, exists, gte, lte } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { Policy } from "../../types.js";
import type { ReleaseWithVersionAndVariables } from "./types.js";

const log = logger.child({
  module: "rule-engine",
  function: "getReleases",
});

const getIsDateBoundsValid = (
  latestDeployedReleaseDate?: Date,
  desiredReleaseCreatedAt?: Date,
) => {
  if (latestDeployedReleaseDate == null) return true;
  if (desiredReleaseCreatedAt == null) return true;
  return !isAfter(latestDeployedReleaseDate, desiredReleaseCreatedAt);
};

/**
 * Finds all releases between two deployments that match the given policy
 *
 * @param db - Database transaction object for querying
 * @param releaseTargetId - ID of the release target to find releases for
 * @param policy - Optional policy to filter releases by version selector
 * @returns Promise resolving to array of matching releases with their
 * associated version and variable data
 */
export const findPolicyMatchingReleasesBetweenDeployments = async (
  db: Tx,
  releaseTargetId: string,
  policy?: Policy | null,
): Promise<ReleaseWithVersionAndVariables[]> => {
  const releaseTarget = await db.query.releaseTarget.findFirst({
    where: eq(SCHEMA.releaseTarget.id, releaseTargetId),
    with: {
      desiredRelease: true,
      releases: {
        limit: 1,
        where: exists(
          db
            .select()
            .from(SCHEMA.releaseJob)
            .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
            .where(
              and(
                eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
                eq(SCHEMA.job.status, JobStatus.Successful),
              ),
            )
            .limit(1),
        ),
        orderBy: desc(SCHEMA.release.createdAt),
      },
    },
  });

  if (releaseTarget == null) return [];

  const latestDeployedRelease = releaseTarget.releases.at(0);

  const isDateBoundsValid = getIsDateBoundsValid(
    latestDeployedRelease?.createdAt,
    releaseTarget.desiredRelease?.createdAt,
  );

  if (!isDateBoundsValid)
    log.warn(
      `Date bounds are invalid, latestDeployedRelease is after desiredRelease: 
        latestDeployedRelease: ${latestDeployedRelease?.createdAt != null ? latestDeployedRelease.createdAt.toISOString() : "null"}, 
        releaseTarget: ${releaseTarget.desiredRelease?.createdAt != null ? releaseTarget.desiredRelease.createdAt.toISOString() : "null"}`,
    );

  return db.query.release.findMany({
    where: and(
      eq(SCHEMA.release.releaseTargetId, releaseTarget.id),
      SCHEMA.deploymentVersionMatchesCondition(
        db,
        policy?.deploymentVersionSelector?.deploymentVersionSelector,
      ),
      latestDeployedRelease != null
        ? gte(SCHEMA.release.createdAt, latestDeployedRelease.createdAt)
        : undefined,
      releaseTarget.desiredRelease != null
        ? lte(SCHEMA.release.createdAt, releaseTarget.desiredRelease.createdAt)
        : undefined,
    ),
    with: {
      version: { with: { metadata: true } },
      variables: true,
    },
    orderBy: desc(SCHEMA.release.createdAt),
  });
};

/**
 * Finds the latest release that matches the applicable policies for a given
 * release target
 *
 * @param tx - Database transaction object for querying
 * @param releaseTarget - The release target to find matching releases for
 * @param workspaceId - ID of the workspace to get policies from
 * @returns Promise resolving to the latest matching release, or null if none
 * found
 */
export const findLatestPolicyMatchingRelease = async (
  tx: Tx,
  policy: Policy | null,
  releaseTarget: { id: string },
): Promise<ReleaseWithVersionAndVariables | undefined> => {
  if (policy?.deploymentVersionSelector == null)
    return tx.query.release.findFirst({
      where: eq(SCHEMA.release.releaseTargetId, releaseTarget.id),
      orderBy: desc(SCHEMA.release.createdAt),
      with: { variables: true, version: { with: { metadata: true } } },
    });

  return tx.query.release.findFirst({
    where: and(
      eq(SCHEMA.release.releaseTargetId, releaseTarget.id),
      SCHEMA.deploymentVersionMatchesCondition(
        tx,
        policy.deploymentVersionSelector.deploymentVersionSelector,
      ),
    ),
    with: { variables: true, version: { with: { metadata: true } } },
    orderBy: desc(SCHEMA.release.createdAt),
  });
};
