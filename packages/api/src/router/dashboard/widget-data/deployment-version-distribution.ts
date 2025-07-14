import { z } from "zod";

import { and, count, desc, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { protectedProcedure } from "../../../trpc";

export const deploymentVersionDistribution = protectedProcedure
  .meta({
    authorizationCheck: ({ canUser, input }) =>
      canUser
        .perform(Permission.DeploymentGet)
        .on({ type: "deployment", id: input.deploymentId }),
  })
  .input(
    z.object({
      deploymentId: z.string().uuid(),
      environmentIds: z.array(z.string().uuid()).optional(),
    }),
  )
  .query(async ({ ctx, input: { deploymentId, environmentIds } }) => {
    const envIds = environmentIds ?? [];

    const latestJobsSubquery = ctx.db
      .selectDistinctOn([schema.releaseTarget.id], {
        versionId: schema.deploymentVersion.id,
        versionTag: schema.deploymentVersion.tag,
      })
      .from(schema.releaseTarget)
      .innerJoin(
        schema.versionRelease,
        eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
      )
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
      .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
      .orderBy(schema.releaseTarget.id, desc(schema.job.startedAt))
      .where(
        and(
          eq(schema.releaseTarget.deploymentId, deploymentId),
          envIds.length > 0
            ? inArray(schema.releaseTarget.environmentId, envIds)
            : undefined,
          eq(schema.job.status, JobStatus.Successful),
        ),
      )
      .as("latest_jobs");

    const versionCounts = await ctx.db
      .select({
        versionId: latestJobsSubquery.versionId,
        versionTag: latestJobsSubquery.versionTag,
        count: count(),
      })
      .from(latestJobsSubquery)
      .groupBy(latestJobsSubquery.versionId, latestJobsSubquery.versionTag);

    return versionCounts;
  });
