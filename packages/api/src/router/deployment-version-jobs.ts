import { TRPCError } from "@trpc/server";
import _ from "lodash";
import { z } from "zod";

import { and, desc, eq, ilike, or } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const sortJobsByStatus = (
  a: { status: SCHEMA.JobStatus },
  b: { status: SCHEMA.JobStatus },
) => {
  const statusA = a.status;
  const statusB = b.status;

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
    .query(async ({ ctx, input: { versionId, search } }) => {
      const version = await ctx.db.query.deploymentVersion.findFirst({
        where: eq(SCHEMA.deploymentVersion.id, versionId),
      });
      if (version == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Version not found: ${versionId}`,
        });

      const jobs = await ctx.db
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
          eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
        )
        .innerJoin(
          SCHEMA.versionRelease,
          eq(SCHEMA.releaseTarget.id, SCHEMA.versionRelease.releaseTargetId),
        )
        .innerJoin(
          SCHEMA.release,
          eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
        )
        .leftJoin(
          SCHEMA.releaseJob,
          eq(SCHEMA.release.id, SCHEMA.releaseJob.releaseId),
        )
        .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
        .leftJoin(
          SCHEMA.jobMetadata,
          and(
            eq(SCHEMA.job.id, SCHEMA.jobMetadata.jobId),
            eq(SCHEMA.jobMetadata.key, ReservedMetadataKey.Links),
          ),
        )
        .where(
          and(
            eq(SCHEMA.versionRelease.versionId, version.id),
            or(
              ilike(SCHEMA.deployment.name, `%${search}%`),
              ilike(SCHEMA.environment.name, `%${search}%`),
              ilike(SCHEMA.resource.name, `%${search}%`),
            ),
          ),
        );

      return _.chain(jobs)
        .groupBy((job) => job.environment.id)
        .map((jobs) => {
          const first = jobs[0]!;
          const { environment } = first;

          const releaseTargets = _.chain(jobs)
            .groupBy((job) => job.release_target.id)
            .map((jobs) => {
              const first = jobs[0]!;
              const { release_target, environment, deployment, resource } =
                first;
              return {
                ...release_target,
                environment,
                deployment,
                resource,
                jobs: jobs
                  .map(({ job, job_metadata }) => ({
                    ...job,
                    links:
                      job_metadata?.value != null
                        ? (JSON.parse(job_metadata.value) as Record<
                            string,
                            string
                          >)
                        : {},
                  }))
                  .sort(sortJobsByStatus)
                  .reverse(),
              };
            })
            .value();

          return {
            environment,
            releaseTargets,
          };
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
