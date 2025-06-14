import { TRPCError } from "@trpc/server";
import _ from "lodash";
import { z } from "zod";

import { and, desc, eq } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const sortReleaseTargetsByLatestJobStatus = (
  a: { jobs: { status: SCHEMA.JobStatus }[] },
  b: { jobs: { status: SCHEMA.JobStatus }[] },
) => {
  const statusA = a.jobs.at(0)?.status;
  const statusB = b.jobs.at(0)?.status;

  if (statusA == null && statusB == null) return 0;
  if (statusA == null) return 1;
  if (statusB == null) return -1;

  if (statusA === JobStatus.Failure && statusB !== JobStatus.Failure) return -1;
  if (statusA !== JobStatus.Failure && statusB === JobStatus.Failure) return 1;

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
        .innerJoin(
          SCHEMA.jobMetadata,
          eq(SCHEMA.jobMetadata.jobId, SCHEMA.job.id),
        )
        .where(
          and(
            eq(SCHEMA.versionRelease.versionId, versionId),
            eq(SCHEMA.releaseTarget.deploymentId, version.deploymentId),
            eq(SCHEMA.jobMetadata.key, ReservedMetadataKey.Links),
          ),
        );

      return _.chain(releaseTargets)
        .groupBy((row) => row.release_target.id)
        .map((rowsByTarget) => {
          const releaseTarget = rowsByTarget[0]!.release_target;
          const { environment, deployment, resource } = rowsByTarget[0]!;

          const jobs = rowsByTarget
            .map((row) => {
              const { job, job_metadata } = row;
              const links = JSON.parse(job_metadata.value) as Record<
                string,
                string
              >;
              return { ...job, links };
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          return { ...releaseTarget, jobs, environment, deployment, resource };
        })
        .groupBy((rt) => rt.environment.id)
        .map((targetsByEnvironment) => {
          const { environment } = targetsByEnvironment[0]!;
          const sortedReleaseTargets = targetsByEnvironment.sort(
            sortReleaseTargetsByLatestJobStatus,
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
