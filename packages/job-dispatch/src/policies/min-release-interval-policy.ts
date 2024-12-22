import type { Tx } from "@ctrlplane/db";
import { differenceInMilliseconds } from "date-fns";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, exists, inArray, notExists, sql } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { activeStatus, JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleaseIdPolicyChecker } from "./utils";

const latestCompletedReleaseSubQuery = (db: Tx, environmentIds: string[]) =>
  db
    .select({
      id: SCHEMA.release.id,
      deploymentId: SCHEMA.release.deploymentId,
      version: SCHEMA.release.version,
      createdAt: SCHEMA.release.createdAt,
      name: SCHEMA.release.name,
      config: SCHEMA.release.config,
      environmentId: SCHEMA.environment.id,
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${SCHEMA.release.deploymentId}, ${SCHEMA.releaseJobTrigger.environmentId} ORDER BY ${SCHEMA.release.createdAt} DESC)`.as(
        "rank",
      ),
    })
    .from(SCHEMA.release)
    .innerJoin(
      SCHEMA.environment,
      inArray(SCHEMA.environment.id, environmentIds),
    )
    .where(
      and(
        exists(
          db
            .select()
            .from(SCHEMA.releaseJobTrigger)
            .where(
              and(
                eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.release.id),
                eq(
                  SCHEMA.releaseJobTrigger.environmentId,
                  SCHEMA.environment.id,
                ),
              ),
            )
            .limit(1),
        ),
        notExists(
          db
            .select()
            .from(SCHEMA.releaseJobTrigger)
            .where(
              and(
                eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.release.id),
                eq(
                  SCHEMA.releaseJobTrigger.environmentId,
                  SCHEMA.environment.id,
                ),
                inArray(SCHEMA.job.status, [
                  ...activeStatus,
                  JobStatus.Pending,
                ]),
              ),
            ),
        ),
      ),
    )
    .as("latest_completed_release");

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns ReleaseJobTriggers that pass the min release interval policy
 * ensuring that the minimum interval between releases is respected.
 */
export const isPassingMinReleaseIntervalPolicy: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
) => {
  if (releaseJobTriggers.length === 0) return [];

  const releases = await db
    .select()
    .from(SCHEMA.release)
    .where(
      inArray(
        SCHEMA.release.id,
        releaseJobTriggers.map((rjt) => rjt.releaseId),
      ),
    );

  const environmentIds = releaseJobTriggers.map((rjt) => rjt.environmentId);

  const latestCompletedReleasesSubquery = latestCompletedReleaseSubQuery(
    db,
    environmentIds,
  );

  const environments = await db
    .select()
    .from(SCHEMA.environment)
    .innerJoin(
      SCHEMA.environmentPolicy,
      eq(SCHEMA.environment.policyId, SCHEMA.environmentPolicy.id),
    )
    .leftJoin(
      latestCompletedReleasesSubquery,
      eq(latestCompletedReleasesSubquery.environmentId, SCHEMA.environment.id),
    )
    .where(
      and(
        inArray(
          latestCompletedReleasesSubquery.deploymentId,
          releases.map((r) => r.deploymentId),
        ),
        eq(latestCompletedReleasesSubquery.rank, 1),
      ),
    )
    .then((rows) =>
      _.chain(rows)
        .groupBy((r) => r.environment.id)
        .map((groupedRows) => ({
          ...groupedRows[0]!.environment,
          policy: groupedRows[0]!.environment_policy,
          latestCompletedReleases: groupedRows
            .filter((r) => isPresent(r.latest_completed_release))
            .map((r) => r.latest_completed_release!),
        }))
        .value(),
    );

  return _.chain(releaseJobTriggers)
    .groupBy((rjt) => [rjt.environmentId, rjt.releaseId])
    .filter((groupedTriggers) => {
      const release = releases.find(
        (r) => r.deploymentId === groupedTriggers[0]!.releaseId,
      );
      if (!release) return false;

      const environment = environments.find(
        (e) => e.id === groupedTriggers[0]!.environmentId,
      );
      if (!environment) return true;

      const latestCompletedRelease = environment.latestCompletedReleases.find(
        (r) => r.deploymentId === release.deploymentId,
      );
      if (!latestCompletedRelease) return true;

      const { minimumReleaseInterval } = environment.policy;
      const timeSinceLatestCompletedRelease = differenceInMilliseconds(
        release.createdAt,
        latestCompletedRelease.createdAt,
      );

      return timeSinceLatestCompletedRelease >= minimumReleaseInterval;
    })
    .value()
    .flat();
};
