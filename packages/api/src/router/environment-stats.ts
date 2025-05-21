import { z } from "zod";

import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lte,
  sql,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { analyticsStatuses, JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const environmentStatsRouter = createTRPCRouter({
  unhealthyResources: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "environment", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const latestJobSubquery = ctx.db
        .selectDistinctOn([SCHEMA.versionRelease.releaseTargetId], {
          releaseTargetId: SCHEMA.versionRelease.releaseTargetId,
          status: SCHEMA.job.status,
        })
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

      return ctx.db
        .selectDistinctOn([SCHEMA.releaseTarget.resourceId], {
          value: sql<number>`1`,
        })
        .from(SCHEMA.releaseTarget)
        .innerJoin(
          latestJobSubquery,
          eq(latestJobSubquery.releaseTargetId, SCHEMA.releaseTarget.id),
        )
        .where(
          and(
            eq(latestJobSubquery.status, JobStatus.Failure),
            eq(SCHEMA.releaseTarget.environmentId, input),
          ),
        );
    }),

  failureRate: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input.environmentId }),
    })
    .query(({ ctx, input }) =>
      ctx.db
        .select({
          failureRate: sql<number | null>`
            CAST(
              SUM(
                CASE 
                  WHEN ${SCHEMA.job.status} = ${JobStatus.Successful} THEN 0 ELSE 1 
                END
              ) AS FLOAT
            ) / 
            NULLIF(COUNT(*), 0) * 100
          `.as("failureRate"),
        })
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
        .innerJoin(
          SCHEMA.releaseTarget,
          eq(SCHEMA.versionRelease.releaseTargetId, SCHEMA.releaseTarget.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseTarget.environmentId, input.environmentId),
            gt(SCHEMA.job.createdAt, input.startDate),
            lte(SCHEMA.job.createdAt, input.endDate),
            inArray(SCHEMA.job.status, analyticsStatuses),
          ),
        )
        .limit(1)
        .then(takeFirstOrNull)
        .then((r) => r?.failureRate ?? null),
    ),
});
