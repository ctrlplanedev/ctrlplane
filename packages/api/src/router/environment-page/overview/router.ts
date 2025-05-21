import type { JobStatus } from "@ctrlplane/validators/jobs";
import { z } from "zod";

import { desc, eq, sql } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { activeStatus, failedStatuses } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../../../trpc";

export const overviewRouter = createTRPCRouter({
  deploymentStatus: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const latestJobSubquery = ctx.db
        .selectDistinctOn([SCHEMA.versionRelease.releaseTargetId])
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.releaseJob,
          eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.release,
          eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
        )
        .innerJoin(
          SCHEMA.versionRelease,
          eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
        )
        .orderBy(
          SCHEMA.versionRelease.releaseTargetId,
          desc(SCHEMA.job.startedAt),
        )
        .as("latest_job");

      const statusesByDeployment = await ctx.db
        .select({
          statuses: sql<
            JobStatus[]
          >`COALESCE(json_agg(${latestJobSubquery.job.status}), '[]')`.as(
            "statuses",
          ),
        })
        .from(SCHEMA.releaseTarget)
        .leftJoin(
          latestJobSubquery,
          eq(
            latestJobSubquery.version_release.releaseTargetId,
            SCHEMA.releaseTarget.id,
          ),
        )
        .where(eq(SCHEMA.releaseTarget.environmentId, input))
        .groupBy(SCHEMA.releaseTarget.deploymentId);

      const failed = statusesByDeployment.filter(({ statuses }) =>
        statuses.some((status) => failedStatuses.includes(status)),
      ).length;
      const deploying = statusesByDeployment.filter(({ statuses }) =>
        statuses.some((status) => activeStatus.includes(status)),
      ).length;
      const successful = statusesByDeployment.length - failed - deploying;

      return {
        failed,
        deploying,
        successful,
      };
    }),
});
