import { z } from "zod";

import { and, desc, eq, sql, takeFirstOrNull } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const systemTableRouter = createTRPCRouter({
  cell: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        deploymentId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .query(({ ctx, input }) => {
      const { deploymentId, environmentId } = input;

      return ctx.db
        .select({
          statuses: sql<
            schema.JobStatus[]
          >`json_agg(distinct ${schema.job.status})`,
          versionId: schema.deploymentVersion.id,
          versionName: schema.deploymentVersion.name,
          versionCreatedAt: schema.deploymentVersion.createdAt,
          versionTag: schema.deploymentVersion.tag,
        })
        .from(schema.job)
        .innerJoin(
          schema.releaseJob,
          eq(schema.releaseJob.jobId, schema.job.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.release.id, schema.releaseJob.releaseId),
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
        .where(
          and(
            eq(schema.releaseTarget.deploymentId, deploymentId),
            eq(schema.releaseTarget.environmentId, environmentId),
          ),
        )
        .groupBy(schema.deploymentVersion.id)
        .orderBy(desc(schema.deploymentVersion.createdAt))
        .limit(1)
        .then(takeFirstOrNull);
    }),
});
