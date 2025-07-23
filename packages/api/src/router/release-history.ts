import { z } from "zod";

import { and, desc, eq, isNotNull, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { protectedProcedure } from "../trpc";

export const releaseHistory = protectedProcedure
  .input(
    z.object({
      resourceId: z.string().uuid(),
      deploymentId: z.string().uuid().optional(),
      jobStatus: z.nativeEnum(JobStatus).optional(),
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
    const { resourceId, deploymentId, jobStatus } = input;

    const variableReleaseSubquery = ctx.db
      .select({
        variableSetReleaseId: schema.variableSetRelease.id,
        variables: sql<Record<string, any>>`COALESCE(jsonb_object_agg(
          ${schema.variableValueSnapshot.key},
          ${schema.variableValueSnapshot.value}
        ) FILTER (WHERE ${schema.variableValueSnapshot.id} IS NOT NULL), '{}'::jsonb)`.as(
          "variables",
        ),
      })
      .from(schema.variableSetRelease)
      .leftJoin(
        schema.variableSetReleaseValue,
        eq(
          schema.variableSetRelease.id,
          schema.variableSetReleaseValue.variableSetReleaseId,
        ),
      )
      .leftJoin(
        schema.variableValueSnapshot,
        eq(
          schema.variableSetReleaseValue.variableValueSnapshotId,
          schema.variableValueSnapshot.id,
        ),
      )
      .groupBy(schema.variableSetRelease.id)
      .as("variableRelease");

    const completedJobs = await ctx.db
      .select()
      .from(schema.job)
      .leftJoin(
        schema.jobMetadata,
        and(
          eq(schema.jobMetadata.jobId, schema.job.id),
          eq(schema.jobMetadata.key, ReservedMetadataKey.Links),
        ),
      )
      .innerJoin(schema.releaseJob, eq(schema.releaseJob.jobId, schema.job.id))
      .innerJoin(
        schema.release,
        eq(schema.releaseJob.releaseId, schema.release.id),
      )
      .innerJoin(
        variableReleaseSubquery,
        eq(
          schema.release.variableReleaseId,
          variableReleaseSubquery.variableSetReleaseId,
        ),
      )
      .innerJoin(
        schema.versionRelease,
        eq(schema.release.versionReleaseId, schema.versionRelease.id),
      )
      .innerJoin(
        schema.deploymentVersion,
        eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
      )
      .innerJoin(
        schema.releaseTarget,
        eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
      )
      .innerJoin(
        schema.environment,
        eq(schema.releaseTarget.environmentId, schema.environment.id),
      )
      .innerJoin(
        schema.deployment,
        eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
      )
      .innerJoin(
        schema.system,
        eq(schema.deployment.systemId, schema.system.id),
      )
      .orderBy(desc(schema.job.startedAt))
      .where(
        and(
          eq(schema.releaseTarget.resourceId, resourceId),
          deploymentId != null
            ? eq(schema.deploymentVersion.deploymentId, deploymentId)
            : undefined,
          jobStatus != null ? eq(schema.job.status, jobStatus) : undefined,
          isNotNull(schema.job.startedAt),
        ),
      )
      .limit(500);

    return completedJobs.map((jobResult) => {
      const links =
        jobResult.job_metadata != null
          ? (JSON.parse(jobResult.job_metadata.value) as Record<string, string>)
          : null;
      const job = { ...jobResult.job, links };
      const { release, deployment, system, environment } = jobResult;
      const version = jobResult.deployment_version;
      const variables = jobResult.variableRelease.variables;

      return {
        job,
        release,
        version,
        variables,
        deployment,
        system,
        environment,
      };
    });
  });
