import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, eq, isNull, or, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { getRolloutInfoForReleaseTarget } from "@ctrlplane/rule-engine";
import { getApplicablePoliciesWithoutResourceScope } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { protectedProcedure } from "../trpc";

const releaseTargetsComparator = (
  a: {
    jobs: { status: SCHEMA.JobStatus; createdAt: Date }[];
    resource: { name: string };
    rolloutTime?: Date;
  },
  b: {
    jobs: { status: SCHEMA.JobStatus; createdAt: Date }[];
    resource: { name: string };
    rolloutTime?: Date;
  },
) => {
  const statusA = a.jobs.at(0)?.status;
  const statusB = b.jobs.at(0)?.status;

  if (statusA == null && statusB != null) return 1;
  if (statusA != null && statusB == null) return -1;

  if (statusA === JobStatus.Failure && statusB !== JobStatus.Failure) return -1;
  if (statusA !== JobStatus.Failure && statusB === JobStatus.Failure) return 1;

  if (statusA != null && statusB != null && statusA !== statusB)
    return statusA.localeCompare(statusB);

  const createdAtA = a.jobs.at(0)?.createdAt ?? new Date(0);
  const createdAtB = b.jobs.at(0)?.createdAt ?? new Date(0);

  if (createdAtA.getTime() !== createdAtB.getTime())
    return createdAtB.getTime() - createdAtA.getTime();

  const rolloutTimeA = a.rolloutTime ?? new Date(0);
  const rolloutTimeB = b.rolloutTime ?? new Date(0);
  if (rolloutTimeA.getTime() !== rolloutTimeB.getTime())
    return rolloutTimeA.getTime() - rolloutTimeB.getTime();

  return a.resource.name.localeCompare(b.resource.name);
};

const getVersion = (db: Tx, versionId: string) =>
  db
    .select()
    .from(SCHEMA.deploymentVersion)
    .where(eq(SCHEMA.deploymentVersion.id, versionId))
    .then(takeFirst);

const getVersionSubquery = (db: Tx, versionId: string) =>
  db
    .select({
      jobId: SCHEMA.job.id,
      jobCreatedAt: SCHEMA.job.createdAt,
      jobStatus: SCHEMA.job.status,
      jobExternalId: SCHEMA.job.externalId,
      jobMetadataKey: SCHEMA.jobMetadata.key,
      jobMetadataValue: SCHEMA.jobMetadata.value,
      releaseTargetId: SCHEMA.versionRelease.releaseTargetId,
    })
    .from(SCHEMA.versionRelease)
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
    )
    .innerJoin(
      SCHEMA.releaseJob,
      eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
    )
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
    .leftJoin(SCHEMA.jobMetadata, eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id))
    .where(
      and(
        eq(SCHEMA.versionRelease.versionId, versionId),
        or(
          eq(SCHEMA.jobMetadata.key, ReservedMetadataKey.Links),
          isNull(SCHEMA.jobMetadata.key),
        ),
      ),
    )
    .as("version_subquery");

const getReleaseTargets = (db: Tx, version: SCHEMA.DeploymentVersion) => {
  const versionSubquery = getVersionSubquery(db, version.id);

  return db
    .select()
    .from(SCHEMA.releaseTarget)
    .innerJoin(
      SCHEMA.environment,
      eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
    )
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.releaseTarget.deploymentId, SCHEMA.deployment.id),
    )
    .innerJoin(
      SCHEMA.resource,
      eq(SCHEMA.resource.id, SCHEMA.releaseTarget.resourceId),
    )
    .leftJoin(
      versionSubquery,
      eq(versionSubquery.releaseTargetId, SCHEMA.releaseTarget.id),
    )
    .where(and(eq(SCHEMA.releaseTarget.deploymentId, version.deploymentId)));
};

type ReleaseTarget = Awaited<ReturnType<typeof getReleaseTargets>>[number];

const getTargetsGroupedByEnvironment = (
  db: Tx,
  releaseTargets: ReleaseTarget[],
) =>
  _.chain(releaseTargets)
    .groupBy((row) => row.release_target.id)
    .map((rowsByTarget) => {
      const releaseTarget = rowsByTarget[0]!.release_target;
      const { environment, deployment, resource } = rowsByTarget[0]!;

      const jobs = rowsByTarget
        .map((row) => {
          const { version_subquery } = row;
          if (version_subquery == null) return null;

          const { jobMetadataValue } = version_subquery;
          const links =
            jobMetadataValue == null
              ? ({} as Record<string, string>)
              : (JSON.parse(jobMetadataValue) as Record<string, string>);
          return {
            id: version_subquery.jobId,
            createdAt: version_subquery.jobCreatedAt,
            status: version_subquery.jobStatus,
            externalId: version_subquery.jobExternalId,
            links,
          };
        })
        .filter(isPresent)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      return { ...releaseTarget, jobs, environment, deployment, resource };
    })
    .groupBy((rt) => rt.environment.id)
    .values()
    .value();

type GroupedTargetsByEnvironment = Awaited<
  ReturnType<typeof getTargetsGroupedByEnvironment>
>[number];

const getEnvironmentWithSortedTargets = async (
  db: Tx,
  targetsByEnvironment: GroupedTargetsByEnvironment,
  version: SCHEMA.DeploymentVersion,
) => {
  const { environment, deployment } = targetsByEnvironment[0]!;
  const policies = await getApplicablePoliciesWithoutResourceScope(
    db,
    environment.id,
    deployment.id,
  );
  const rolloutPolicy = policies.find(
    (p) => p.environmentVersionRollout != null,
  );
  if (rolloutPolicy == null) {
    const sortedReleaseTargets = targetsByEnvironment.sort(
      releaseTargetsComparator,
    );
    return { environment, releaseTargets: sortedReleaseTargets };
  }

  const releaseTargetsWithRolloutInfoPromises = targetsByEnvironment.map(
    async (target) => {
      const rolloutInfo = await getRolloutInfoForReleaseTarget(
        db,
        target,
        rolloutPolicy,
        version,
      );
      const rolloutTime = rolloutInfo.rolloutTime ?? undefined;
      return { ...target, rolloutTime };
    },
  );

  const releaseTargetsWithRolloutInfo = await Promise.all(
    releaseTargetsWithRolloutInfoPromises,
  );

  const sortedReleaseTargets = releaseTargetsWithRolloutInfo.sort(
    releaseTargetsComparator,
  );

  return { environment, releaseTargets: sortedReleaseTargets };
};

export const deploymentVersionJobsList = protectedProcedure
  .input(
    z.object({
      versionId: z.string().uuid(),
      search: z.string().default(""),
    }),
  )
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser.perform(Permission.DeploymentVersionGet).on({
        type: "deploymentVersion",
        id: input.versionId,
      }),
  })
  .query(async ({ ctx, input: { versionId } }) => {
    const version = await getVersion(ctx.db, versionId);
    const releaseTargets = await getReleaseTargets(ctx.db, version);
    const targetsByEnvironment = getTargetsGroupedByEnvironment(
      ctx.db,
      releaseTargets,
    );
    const environmentsWithSortedReleaseTargets = await Promise.all(
      targetsByEnvironment.map((targetsByEnvironment) =>
        getEnvironmentWithSortedTargets(ctx.db, targetsByEnvironment, version),
      ),
    );
    return environmentsWithSortedReleaseTargets.sort((a, b) =>
      a.environment.name.localeCompare(b.environment.name),
    );
  });
