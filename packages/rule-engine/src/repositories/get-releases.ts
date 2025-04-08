import type { Tx } from "@ctrlplane/db";
import { isAfter } from "date-fns";

import { and, desc, eq, exists, gte, lte, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { Policy } from "../types.js";
import type { CompleteRelease } from "./types.js";

const log = logger.child({
  module: "rule-engine",
  function: "getReleases",
});

/**
 * Checks if the date bounds between the latest deployed release and desired release are valid
 * @param latestDeployedReleaseDate - Creation date of the latest deployed release
 * @param desiredReleaseCreatedAt - Creation date of the desired release
 * @returns True if dates are valid (deployed not after desired)
 */
const isDateBoundsValid = (
  latestDeployedReleaseDate?: Date,
  desiredReleaseCreatedAt?: Date,
): boolean => {
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
): Promise<CompleteRelease[]> => {
  const releaseTarget = await db.query.releaseTarget.findFirst({
    where: eq(schema.releaseTarget.id, releaseTargetId),
    with: {
      desiredRelease: true,
      releases: {
        limit: 1,
        where: exists(
          db
            .select()
            .from(schema.release)
            .innerJoin(schema.job, eq(schema.release.jobId, schema.job.id))
            .where(
              and(
                sql`${schema.release.releaseId} = "releaseTarget_releases"."id"`,
                eq(schema.job.status, JobStatus.Successful),
              ),
            )
            .limit(1),
        ),
        orderBy: desc(schema.versionRelease.createdAt),
      },
    },
  });

  if (releaseTarget == null) return [];

  const latestDeployedRelease = releaseTarget.releases.at(0);

  const dateCheckResult = isDateBoundsValid(
    latestDeployedRelease?.createdAt,
    releaseTarget.desiredRelease?.createdAt,
  );

  if (!dateCheckResult) {
    log.warn(
      `Date bounds are invalid, latestDeployedRelease is after desiredRelease: 
        latestDeployedRelease: ${latestDeployedRelease?.createdAt != null ? latestDeployedRelease.createdAt.toISOString() : "null"}, 
        releaseTarget: ${releaseTarget.desiredRelease?.createdAt != null ? releaseTarget.desiredRelease.createdAt.toISOString() : "null"}`,
    );
  }

  return db.query.versionRelease.findMany({
    where: and(
      eq(schema.versionRelease.releaseTargetId, releaseTarget.id),
      schema.deploymentVersionMatchesCondition(
        db,
        policy?.deploymentVersionSelector?.deploymentVersionSelector,
      ),
      latestDeployedRelease != null
        ? gte(schema.versionRelease.createdAt, latestDeployedRelease.createdAt)
        : undefined,
      releaseTarget.desiredRelease != null
        ? lte(
            schema.versionRelease.createdAt,
            releaseTarget.desiredRelease.createdAt,
          )
        : undefined,
    ),
    with: {
      version: { with: { metadata: true } },
      variables: true,
    },
    orderBy: desc(schema.versionRelease.createdAt),
  });
};

/**
 * Finds the latest release that matches the applicable policies for a given
 * release target
 *
 * @param tx - Database transaction object for querying
 * @param policy - The policy to filter releases by
 * @param releaseTarget - The release target to find matching releases for
 * @returns Promise resolving to the latest matching release, or undefined if none found
 */
export const findLatestPolicyMatchingRelease = async (
  tx: Tx,
  policy: Policy | null,
  releaseTarget: { id: string },
): Promise<CompleteRelease | undefined> => {
  // If no deployment version selector in policy, return latest release for target
  if (policy?.deploymentVersionSelector == null) {
    return tx.query.versionRelease.findFirst({
      where: eq(schema.versionRelease.releaseTargetId, releaseTarget.id),
      orderBy: desc(schema.versionRelease.createdAt),
      with: { variables: true, version: { with: { metadata: true } } },
    });
  }

  // Otherwise filter by policy deployment version selector
  return tx.query.versionRelease.findFirst({
    where: and(
      eq(schema.versionRelease.releaseTargetId, releaseTarget.id),
      schema.deploymentVersionMatchesCondition(
        tx,
        policy.deploymentVersionSelector.deploymentVersionSelector,
      ),
    ),
    with: { variables: true, version: { with: { metadata: true } } },
    orderBy: desc(schema.versionRelease.createdAt),
  });
};
