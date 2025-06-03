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

      const releaseTargets = await ctx.db.query.releaseTarget.findMany({
        where: eq(SCHEMA.releaseTarget.deploymentId, version.deploymentId),
        with: {
          environment: true,
          resource: true,
          deployment: true,
          versionReleases: {
            where: eq(SCHEMA.versionRelease.versionId, versionId),
            with: {
              release: {
                with: {
                  releaseJobs: { with: { job: { with: { metadata: true } } } },
                },
              },
            },
          },
        },
      });

      return _.chain(releaseTargets)
        .groupBy(({ environmentId }) => environmentId)
        .map((groupedReleaseTargets) => {
          const { environment } = groupedReleaseTargets[0]!;

          const releaseTargets = groupedReleaseTargets
            .map((releaseTarget) => {
              const jobs = releaseTarget.versionReleases
                .flatMap((vr) =>
                  vr.release.flatMap((release) =>
                    release.releaseJobs.map((rj) => {
                      const { job } = rj;
                      const linksMetadata = job.metadata.find(
                        (m) => m.key === String(ReservedMetadataKey.Links),
                      );
                      const links =
                        linksMetadata != null
                          ? (JSON.parse(linksMetadata.value) as Record<
                              string,
                              string
                            >)
                          : {};
                      return { ...job, links };
                    }),
                  ),
                )
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

              return { ...releaseTarget, jobs };
            })
            .sort(sortReleaseTargetsByLatestJobStatus);

          return { environment, releaseTargets };
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
