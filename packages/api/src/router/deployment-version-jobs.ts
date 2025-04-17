import type { Tx } from "@ctrlplane/db";
import { TRPCError } from "@trpc/server";
import _ from "lodash";
import { z } from "zod";

import { and, desc, eq, or, sql } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const DEFAULT_JOB = {
  metadata: {} as Record<string, string>,
  type: "",
  status: JobStatus.Pending,
  externalId: undefined as string | undefined,
  createdAt: undefined as Date | undefined,
};

const getReleaseTargetRows = async (
  db: Tx,
  deploymentId: string,
  versionId: string,
  query: string,
) => {
  const queryCheck =
    query === ""
      ? undefined
      : or(
          sql`"releaseTarget_environment"."data" ->> 2 ilike ${"%" + query + "%"}`,
          sql`"releaseTarget_resource"."data" ->> 2 ilike ${"%" + query + "%"}`,
        );

  return db.query.releaseTarget.findMany({
    where: and(eq(SCHEMA.releaseTarget.deploymentId, deploymentId), queryCheck),
    with: {
      environment: true,
      resource: true,
      versionReleases: {
        where: eq(SCHEMA.versionRelease.versionId, versionId),
        limit: 1,
        orderBy: desc(SCHEMA.versionRelease.createdAt),
        with: {
          release: {
            with: {
              releaseJobs: {
                with: { job: { with: { metadata: true, agent: true } } },
              },
            },
          },
        },
      },
    },
  });
};

const getReleaseTargets = async (
  db: Tx,
  version: SCHEMA.DeploymentVersion,
  query: string,
) => {
  const releaseTargetRows = await getReleaseTargetRows(
    db,
    version.deploymentId,
    version.id,
    query,
  );

  return releaseTargetRows.map((rt) => {
    const { versionReleases, ...rest } = rt;
    const versionRelease = versionReleases.at(0);
    if (versionRelease == null)
      return {
        ...rest,
        jobs: [{ ...DEFAULT_JOB, id: rest.resource.id }],
      };

    const jobs = versionRelease.release
      .flatMap((rel) =>
        rel.releaseJobs.map(({ job }) => ({
          id: job.id,
          metadata: Object.fromEntries(
            job.metadata.map((m) => [m.key, m.value]),
          ),
          type: job.agent?.type ?? "custom",
          status: job.status as JobStatus,
          externalId: job.externalId ?? undefined,
          createdAt: job.createdAt,
        })),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    return { ...rest, jobs };
  });
};

const groupReleaseTargetsByEnvironment = (
  releaseTargets: Awaited<ReturnType<typeof getReleaseTargets>>,
) =>
  _.chain(releaseTargets)
    .groupBy((rt) => rt.environment.id)
    .map((envReleaseTargets) => {
      const first = envReleaseTargets[0]!;
      const { environment } = first;

      const sortedByLatestJobStatus = envReleaseTargets
        .sort((a, b) => {
          const { status: statusA } = a.jobs[0]!;
          const { status: statusB } = b.jobs[0]!;

          if (statusA === JobStatus.Failure && statusB !== JobStatus.Failure)
            return -1;
          if (statusA !== JobStatus.Failure && statusB === JobStatus.Failure)
            return 1;

          return statusA.localeCompare(statusB);
        })
        .map((rt) => {
          const { environment: _, ...releaseTarget } = rt;
          return releaseTarget;
        });

      const statusCounts = _.chain(envReleaseTargets)
        .groupBy((rt) => rt.jobs[0]!.status)
        .map((groupedStatuses) => ({
          status: groupedStatuses[0]!.jobs[0]!.status,
          count: groupedStatuses.length,
        }))
        .value();

      return {
        ...environment,
        releaseTargets: sortedByLatestJobStatus,
        statusCounts,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .value();

export const deploymentVersionJobsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        versionId: z.string().uuid(),
        query: z.string().default(""),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deploymentVersion",
          id: input.versionId,
        }),
    })
    .query(async ({ ctx, input: { versionId, query } }) => {
      const version = await ctx.db.query.deploymentVersion.findFirst({
        where: eq(SCHEMA.deploymentVersion.id, versionId),
      });
      if (version == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Version not found: ${versionId}`,
        });

      const releaseTargets = await getReleaseTargets(ctx.db, version, query);
      return groupReleaseTargetsByEnvironment(releaseTargets);
    }),
});
