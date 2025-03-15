import type { Tx } from "@ctrlplane/db";
import { isAfter } from "date-fns";
import _ from "lodash";

import {
  and,
  desc,
  eq,
  inArray,
  isNull,
  notExists,
  notInArray,
  sql,
  takeFirstOrNull,
} from "@ctrlplane/db";
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
      schema.deploymentVersion,
      eq(schema.releaseJobTrigger.versionId, schema.deploymentVersion.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
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
            inner join ${schema.deploymentVersion} as release2 on rjt2.deployment_version_id = release2.id
            inner join ${schema.resource} on rjt2.resource_id = ${schema.resource.id}
            where rjt2.environment_id = ${schema.releaseJobTrigger.environmentId}
            and release2.deployment_id = ${schema.deployment.id}
            and release2.id != ${schema.deploymentVersion.id}
            and ${inArray(schema.job.status, activeStatus)}
            and ${isNull(schema.resource.deletedAt)}
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
        rjt.deployment_version.createdAt,
        rjt.deployment_version.version,
      ]);
      return rjt.filter(
        (rjt) =>
          rjt.deployment_version.id === maxRelease?.deployment_version.id,
      );
    })
    .map((rjt) => rjt.release_job_trigger)
    .value();
};

const isReleaseLatestActiveForEnvironment = async (
  db: Tx,
  release: schema.DeploymentVersion,
  environmentId: string,
) => {
  const releaseChannelSubquery = db
    .select({
      rcPolicyId: schema.environmentPolicyReleaseChannel.policyId,
      rcReleaseFilter: schema.deploymentVersionChannel.releaseFilter,
    })
    .from(schema.environmentPolicyReleaseChannel)
    .innerJoin(
      schema.deploymentVersionChannel,
      eq(
        schema.environmentPolicyReleaseChannel.channelId,
        schema.deploymentVersionChannel.id,
      ),
    )
    .where(
      eq(
        schema.environmentPolicyReleaseChannel.deploymentId,
        release.deploymentId,
      ),
    )
    .as("release_channel");

  const environment = await db
    .select()
    .from(schema.environment)
    .innerJoin(
      schema.environmentPolicy,
      eq(schema.environment.policyId, schema.environmentPolicy.id),
    )
    .leftJoin(
      releaseChannelSubquery,
      eq(schema.environmentPolicy.id, releaseChannelSubquery.rcPolicyId),
    )
    .where(eq(schema.environment.id, environmentId))
    .then(takeFirstOrNull);
  if (!environment) return false;

  const latestActiveRelease = await db
    .select()
    .from(schema.deploymentVersion)
    .innerJoin(
      schema.releaseJobTrigger,
      eq(schema.releaseJobTrigger.versionId, schema.deploymentVersion.id),
    )
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .innerJoin(
      schema.resource,
      eq(schema.releaseJobTrigger.resourceId, schema.resource.id),
    )
    .where(
      and(
        notInArray(schema.job.status, [
          JobStatus.Pending,
          JobStatus.Skipped,
          JobStatus.Cancelled,
        ]),
        isNull(schema.resource.deletedAt),
        eq(schema.deploymentVersion.deploymentId, release.deploymentId),
        eq(schema.releaseJobTrigger.environmentId, environmentId),
        schema.deploymentVersionMatchesCondition(
          db,
          environment.release_channel?.rcReleaseFilter,
        ),
      ),
    )
    .orderBy(desc(schema.deploymentVersion.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  if (!latestActiveRelease) return true;

  return (
    release.id === latestActiveRelease.deployment_version.id ||
    isAfter(release.createdAt, latestActiveRelease.deployment_version.createdAt)
  );
};

/**
 * This policy checks if the release is newer than the last release that was deployed for a deployment/environment.
 * i.e. you can only dispatch a release if every release later than it is pending.
 * @param db
 * @param releaseJobTriggers
 */
export const isPassingNewerThanLastActiveReleasePolicy: ReleaseIdPolicyChecker =
  async (db, releaseJobTriggers) => {
    if (releaseJobTriggers.length === 0) return [];

    const versionIds = releaseJobTriggers.map((rjt) => rjt.versionId);
    const releases = await db
      .select()
      .from(schema.deploymentVersion)
      .where(inArray(schema.deploymentVersion.id, versionIds));

    return _.chain(releaseJobTriggers)
      .groupBy((rjt) => [rjt.versionId, rjt.environmentId])
      .map(async (groupedTriggers) => {
        const release = releases.find(
          (r) => r.id === groupedTriggers[0]!.versionId,
        );
        if (!release) return [];
        const { environmentId } = groupedTriggers[0]!;
        const isLatestActive = await isReleaseLatestActiveForEnvironment(
          db,
          release,
          environmentId,
        );
        return isLatestActive ? groupedTriggers : [];
      })
      .thru((promises) => Promise.all(promises))
      .value()
      .then((triggers) => triggers.flat());
  };
