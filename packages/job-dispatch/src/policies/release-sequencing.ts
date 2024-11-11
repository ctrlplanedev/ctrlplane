import type { Tx } from "@ctrlplane/db";
import { isAfter } from "date-fns";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, ne, notExists, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { activeStatus, JobStatus } from "@ctrlplane/validators/jobs";

import type { ReleaseIdPolicyChecker } from "./utils.js";

/**
 *
 * @param db
 * @param releaseJobTriggers
 * @returns job triggers that are not blocked by an active release
 */
export const isPassingNoActiveJobsPolicy: ReleaseIdPolicyChecker = async (
  db,
  releaseJobTriggers,
) => {
  if (releaseJobTriggers.length === 0) return [];

  const unblockedTriggers = await db
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .where(
      and(
        inArray(
          schema.releaseJobTrigger.id,
          releaseJobTriggers.map((t) => t.id),
        ),
        notExists(
          db.execute(sql<schema.Job[]>`
            select 1 from ${schema.job}
            inner join ${schema.releaseJobTrigger} as rjt2 on ${schema.job.id} = rjt2.job_id
            inner join ${schema.release} as release2 on rjt2.release_id = release2.id
            where rjt2.environment_id = ${schema.releaseJobTrigger.environmentId}
            and release2.deployment_id = ${schema.deployment.id}
            and release2.id != ${schema.release.id}
            and ${inArray(schema.job.status, activeStatus)}
          `),
        ),
      ),
    );

  // edge case - if multiple releases are created at the same time, only take latest, then highest lexicographical version
  return _.chain(unblockedTriggers)
    .groupBy((rjt) => [
      rjt.deployment.id,
      rjt.release_job_trigger.environmentId,
    ])
    .flatMap((rjt) => {
      const maxRelease = _.maxBy(rjt, (rjt) => [
        rjt.release.createdAt,
        rjt.release.version,
      ]);
      return rjt.filter((rjt) => rjt.release.id === maxRelease?.release.id);
    })
    .map((rjt) => rjt.release_job_trigger)
    .value();
};

const latestActiveReleaseSubQuery = (db: Tx) =>
  db
    .select({
      id: schema.release.id,
      deploymentId: schema.release.deploymentId,
      version: schema.release.version,
      createdAt: schema.release.createdAt,
      name: schema.release.name,
      config: schema.release.config,
      environmentId: schema.releaseJobTrigger.environmentId,
      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${schema.release.deploymentId}, ${schema.releaseJobTrigger.environmentId} ORDER BY ${schema.release.createdAt} DESC)`.as(
        "rank",
      ),
    })
    .from(schema.release)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .where(ne(schema.job.status, JobStatus.Pending))
    .as("active_releases");

/**
 * This policy checks if the release is newer than the last release that was deployed for a deployment/environment.
 * i.e. you can only dispatch a release if every release later than it is pending.
 * @param db
 * @param releaseJobTriggers
 */
export const isPassingNewerThanLastActiveReleasePolicy: ReleaseIdPolicyChecker =
  async (db, releaseJobTriggers) => {
    if (releaseJobTriggers.length === 0) return [];

    const activeRelease = latestActiveReleaseSubQuery(db);

    const releaseIds = releaseJobTriggers.map((rjt) => rjt.releaseId);
    const releases = await db
      .select()
      .from(schema.release)
      .where(inArray(schema.release.id, releaseIds));

    const deploymentIds = _.uniq(releases.map((r) => r.deploymentId));
    const deployments = await db
      .select()
      .from(schema.deployment)
      .leftJoin(
        activeRelease,
        and(
          eq(activeRelease.deploymentId, schema.deployment.id),
          eq(activeRelease.rank, 1),
        ),
      )
      .where(inArray(schema.deployment.id, deploymentIds))
      .then((rows) =>
        _.chain(rows)
          .groupBy((r) => r.deployment.id)
          .map((r) => ({
            ...r[0]!.deployment,
            activeReleases: r.map((r) => r.active_releases).filter(isPresent),
          }))
          .value(),
      );

    return _.chain(releaseJobTriggers)
      .groupBy((rjt) => {
        const release = releases.find((r) => r.id === rjt.releaseId);
        if (!release) return null;
        return [rjt.environmentId, rjt.releaseId];
      })
      .filter(isPresent)
      .map((t) => {
        const release = releases.find((r) => r.id === t[0]!.releaseId);
        if (!release) return null;
        const deployment = deployments.find(
          (d) => d.id === release.deploymentId,
        );
        if (!deployment) return null;
        const activeRelease = deployment.activeReleases.find(
          (r) => r.environmentId === t[0]!.environmentId,
        );
        if (!activeRelease) return t;
        if (release.id === activeRelease.id) return t;
        return isAfter(release.createdAt, activeRelease.createdAt) ? t : null;
      })
      .filter(isPresent)
      .value()
      .flat();
  };
