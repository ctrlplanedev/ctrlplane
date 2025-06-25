import { TRPCError } from "@trpc/server";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, desc, eq, isNull, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const sortReleaseTargetsByLatestJobStatusAndStartedAt = (
  a: { jobs: { status: SCHEMA.JobStatus; createdAt: Date }[] },
  b: { jobs: { status: SCHEMA.JobStatus; createdAt: Date }[] },
) => {
  const statusA = a.jobs.at(0)?.status;
  const statusB = b.jobs.at(0)?.status;

  if (statusA == null && statusB == null) return 0;
  if (statusA == null) return 1;
  if (statusB == null) return -1;

  if (statusA === JobStatus.Failure && statusB !== JobStatus.Failure) return -1;
  if (statusA !== JobStatus.Failure && statusB === JobStatus.Failure) return 1;

  if (statusA === statusB) {
    const createdAtA = a.jobs.at(0)?.createdAt ?? new Date(0);
    const createdAtB = b.jobs.at(0)?.createdAt ?? new Date(0);
    return createdAtA.getTime() - createdAtB.getTime();
  }

  return statusA.localeCompare(statusB);
};

export const deploymentVersionJobsRouter = createTRPCRouter({
  list: protectedProcedure
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
      const version = await ctx.db.query.deploymentVersion.findFirst({
        where: eq(SCHEMA.deploymentVersion.id, versionId),
      });
      if (version == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Version not found: ${versionId}`,
        });

      const versionSubquery = ctx.db
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
        .leftJoin(
          SCHEMA.jobMetadata,
          eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
        )
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

      const releaseTargets = await ctx.db
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
        .where(
          and(eq(SCHEMA.releaseTarget.deploymentId, version.deploymentId)),
        );

      return _.chain(releaseTargets)
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
        .map((targetsByEnvironment) => {
          const { environment } = targetsByEnvironment[0]!;
          const sortedReleaseTargets = targetsByEnvironment.sort(
            sortReleaseTargetsByLatestJobStatusAndStartedAt,
          );
          return { environment, releaseTargets: sortedReleaseTargets };
        })
        .sortBy(({ environment }) => environment.name)
        .value();
    }),

  byEnvironment: protectedProcedure
    .input(
      z.object({
        versionId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deploymentVersion",
          id: input.versionId,
        }),
    })
    .query(({ ctx, input: { versionId, environmentId } }) =>
      ctx.db
        .selectDistinctOn([SCHEMA.releaseTarget.id])
        .from(SCHEMA.releaseTarget)
        .innerJoin(
          SCHEMA.versionRelease,
          eq(SCHEMA.versionRelease.releaseTargetId, SCHEMA.releaseTarget.id),
        )
        .innerJoin(
          SCHEMA.release,
          eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
        )
        .innerJoin(
          SCHEMA.releaseJob,
          eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
        )
        .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
        .where(
          and(
            eq(SCHEMA.versionRelease.versionId, versionId),
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
          ),
        )
        .orderBy(SCHEMA.releaseTarget.id, desc(SCHEMA.job.createdAt))
        .then((results) => results.map(({ job }) => job)),
    ),
});
