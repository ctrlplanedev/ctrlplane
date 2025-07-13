import _ from "lodash";
import { z } from "zod";

import { and, desc, eq } from "@ctrlplane/db";
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
