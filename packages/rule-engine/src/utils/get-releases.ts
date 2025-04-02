import type { Tx } from "@ctrlplane/db";
import { isAfter } from "date-fns";

import { and, desc, eq, exists, gte, lte } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { JobStatus } from "@ctrlplane/validators/jobs";

import type { DeploymentResourceContext } from "..";

type Policy = SCHEMA.Policy & {
  denyWindows: SCHEMA.PolicyRuleDenyWindow[];
  deploymentVersionSelector: SCHEMA.PolicyDeploymentVersionSelector | null;
};

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

export const getReleasesFromDb =
  (db: Tx) => async (ctx: DeploymentResourceContext, policy: Policy) => {
    const releaseTarget = await db.query.releaseTarget.findFirst({
      where: and(
        eq(SCHEMA.releaseTarget.resourceId, ctx.resource.id),
        eq(SCHEMA.releaseTarget.environmentId, ctx.environment.id),
        eq(SCHEMA.releaseTarget.deploymentId, ctx.deployment.id),
      ),
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

    return db.query.release
      .findMany({
        where: and(
          eq(SCHEMA.release.releaseTargetId, releaseTarget.id),
          SCHEMA.deploymentVersionMatchesCondition(
            db,
            policy.deploymentVersionSelector?.deploymentVersionSelector,
          ),
          latestDeployedRelease != null
            ? gte(SCHEMA.release.createdAt, latestDeployedRelease.createdAt)
            : undefined,
          releaseTarget.desiredRelease != null
            ? lte(
                SCHEMA.release.createdAt,
                releaseTarget.desiredRelease.createdAt,
              )
            : undefined,
        ),
        with: {
          version: { with: { metadata: true } },
          variables: true,
        },
        orderBy: desc(SCHEMA.release.createdAt),
      })
      .then((releases) =>
        releases.map((release) => ({
          ...release,
          variables: Object.fromEntries(
            release.variables.map((v) => [v.key, v.value]),
          ),
          version: {
            ...release.version,
            metadata: Object.fromEntries(
              release.version.metadata.map((m) => [m.key, m.value]),
            ),
          },
        })),
      );
  };
