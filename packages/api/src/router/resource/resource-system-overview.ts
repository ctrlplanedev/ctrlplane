import _ from "lodash-es";
import { z } from "zod";

import { and, desc, eq, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { protectedProcedure } from "../../trpc";

export const resourceSystemOverview = protectedProcedure
  .input(
    z.object({
      resourceId: z.string().uuid(),
      systemId: z.string().uuid(),
    }),
  )
  .meta({
    authorizationCheck: async ({ canUser, input }) =>
      canUser.perform(Permission.ResourceGet).on({
        type: "resource",
        id: input.resourceId,
      }),
  })
  .query(async ({ ctx, input }) => {
    const { resourceId, systemId } = input;
    const jobStatusSubquery = ctx.db
      .selectDistinctOn([schema.versionRelease.releaseTargetId], {
        releaseTargetId: schema.versionRelease.releaseTargetId,
        status: schema.job.status,
      })
      .from(schema.versionRelease)
      .innerJoin(
        schema.release,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.releaseJob,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
      .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
      .orderBy(
        schema.versionRelease.releaseTargetId,
        desc(schema.job.createdAt),
      )
      .as("jobStatus");

    const releaseTargetsWithJobStatus = await ctx.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .leftJoin(
        jobStatusSubquery,
        eq(jobStatusSubquery.releaseTargetId, schema.releaseTarget.id),
      )
      .where(
        and(
          eq(schema.releaseTarget.resourceId, resourceId),
          eq(schema.system.id, systemId),
        ),
      );

    return releaseTargetsWithJobStatus.map((releaseTarget) => ({
      ...releaseTarget.deployment,
      status: releaseTarget.jobStatus?.status ?? null,
    }));
  });

export const allSystemsOverview = protectedProcedure
  .input(z.string().uuid())
  .meta({
    authorizationCheck: async ({ canUser, input }) =>
      canUser.perform(Permission.ResourceGet).on({
        type: "resource",
        id: input,
      }),
  })
  .query(async ({ ctx, input }) => {
    const resourceId = input;

    const jobAndMetadataSubquery = ctx.db
      .select({
        jobId: sql<string>`${schema.job.id}`.as("jobId"),
        status: schema.job.status,
        createdAt: schema.job.createdAt,
        metadata: sql<Record<string, string>>`COALESCE(jsonb_object_agg(
          ${schema.jobMetadata.key},
          ${schema.jobMetadata.value}
        ) FILTER (WHERE ${schema.jobMetadata.key} IS NOT NULL), '{}'::jsonb)`.as(
          "metadata",
        ),
      })
      .from(schema.job)
      .leftJoin(schema.jobMetadata, eq(schema.job.id, schema.jobMetadata.jobId))
      .groupBy(schema.job.id)
      .as("jobAndMetadata");

    const latestJobSubquery = ctx.db
      .selectDistinctOn([schema.versionRelease.releaseTargetId], {
        releaseTargetId: schema.versionRelease.releaseTargetId,
        jobId: jobAndMetadataSubquery.jobId,
        jobStatus: jobAndMetadataSubquery.status,
        jobCreatedAt: jobAndMetadataSubquery.createdAt,
        jobMetadata: jobAndMetadataSubquery.metadata,
        versionId: schema.deploymentVersion.id,
        versionName: schema.deploymentVersion.name,
        versionTag: schema.deploymentVersion.tag,
      })
      .from(schema.versionRelease)
      .innerJoin(
        schema.deploymentVersion,
        eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
      )
      .innerJoin(
        schema.release,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.releaseJob,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
      .innerJoin(
        jobAndMetadataSubquery,
        eq(schema.releaseJob.jobId, jobAndMetadataSubquery.jobId),
      )
      .orderBy(
        schema.versionRelease.releaseTargetId,
        desc(jobAndMetadataSubquery.createdAt),
      )
      .as("latestJob");

    const releaseTargets = await ctx.db
      .select()
      .from(schema.releaseTarget)
      .innerJoin(
        schema.deployment,
        eq(schema.releaseTarget.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseTarget.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .leftJoin(
        latestJobSubquery,
        eq(latestJobSubquery.releaseTargetId, schema.releaseTarget.id),
      )
      .where(eq(schema.releaseTarget.resourceId, resourceId));

    return _.chain(releaseTargets)
      .map((releaseTarget) => {
        const { latestJob, ...rest } = releaseTarget;
        return {
          ...rest,
          version:
            latestJob != null
              ? {
                  id: latestJob.versionId,
                  name: latestJob.versionName,
                  tag: latestJob.versionTag,
                  job: {
                    id: latestJob.jobId,
                    status: latestJob.jobStatus,
                    createdAt: latestJob.jobCreatedAt,
                    metadata: latestJob.jobMetadata,
                  },
                }
              : null,
        };
      })
      .groupBy((r) => r.system.id)
      .map((groupedReleaseTargets) => {
        const { system, environment } = groupedReleaseTargets[0]!;
        const deployments = groupedReleaseTargets.map((r) => ({
          ...r.deployment,
          version: r.version,
          releaseTarget: r.release_target,
        }));
        return { ...system, environment, deployments };
      })
      .value();
  });
