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
    const latestDeployedRelease = await db.query.release.findFirst({
      where: and(
        eq(SCHEMA.release.deploymentId, ctx.deployment.id),
        eq(SCHEMA.release.resourceId, ctx.resource.id),
        eq(SCHEMA.release.environmentId, ctx.environment.id),
        exists(
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
      ),
      orderBy: desc(SCHEMA.release.createdAt),
    });

    const resourceRelease = await db.query.resourceRelease.findFirst({
      where: and(
        eq(SCHEMA.resourceRelease.resourceId, ctx.resource.id),
        eq(SCHEMA.resourceRelease.environmentId, ctx.environment.id),
        eq(SCHEMA.resourceRelease.deploymentId, ctx.deployment.id),
      ),
      with: { desiredRelease: true },
    });

    const isDateBoundsValid = getIsDateBoundsValid(
      latestDeployedRelease?.createdAt,
      resourceRelease?.desiredRelease?.createdAt,
    );

    if (!isDateBoundsValid)
      log.warn(
        `Date bounds are invalid, latestDeployedRelease is after desiredRelease: 
        latestDeployedRelease: ${latestDeployedRelease?.createdAt != null ? latestDeployedRelease.createdAt.toISOString() : "null"}, 
        resourceRelease: ${resourceRelease?.desiredRelease?.createdAt != null ? resourceRelease.desiredRelease.createdAt.toISOString() : "null"}`,
      );

    return db.query.release
      .findMany({
        where: and(
          eq(SCHEMA.release.deploymentId, ctx.deployment.id),
          eq(SCHEMA.release.resourceId, ctx.resource.id),
          eq(SCHEMA.release.environmentId, ctx.environment.id),
          SCHEMA.deploymentVersionMatchesCondition(
            db,
            policy.deploymentVersionSelector?.deploymentVersionSelector,
          ),
          latestDeployedRelease != null
            ? gte(SCHEMA.release.createdAt, latestDeployedRelease.createdAt)
            : undefined,
          resourceRelease?.desiredRelease != null
            ? lte(
                SCHEMA.release.createdAt,
                resourceRelease.desiredRelease.createdAt,
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
