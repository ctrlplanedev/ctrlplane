import { z } from "zod";

import {
  and,
  eq,
  exists,
  gt,
  inArray,
  isNotNull,
  isNull,
  lte,
  ne,
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
      const environment = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, input))
        .then(takeFirstOrNull);

      if (environment?.resourceSelector == null) return [];

      const statusRankSubquery = ctx.db
        .select({
          environmentId: SCHEMA.releaseJobTrigger.environmentId,
          resourceId: SCHEMA.releaseJobTrigger.resourceId,
          systemId: SCHEMA.deployment.systemId,
          rank: sql<number>`row_number() over (partition by ${SCHEMA.deploymentVersion.deploymentId}, ${SCHEMA.releaseJobTrigger.resourceId} order by ${SCHEMA.job.startedAt} desc)`.as(
            "rank",
          ),
          status: SCHEMA.job.status,
        })
        .from(SCHEMA.job)
        .innerJoin(
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.deploymentVersion,
          eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
        )
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .where(
          and(
            isNotNull(SCHEMA.job.startedAt),
            isNotNull(SCHEMA.job.completedAt),
          ),
        )
        .as("status_rank");

      return ctx.db
        .select({ value: sql<number>`1` })
        .from(SCHEMA.resource)
        .where(
          and(
            exists(
              ctx.db
                .select()
                .from(statusRankSubquery)
                .where(
                  and(
                    eq(statusRankSubquery.environmentId, input),
                    eq(statusRankSubquery.resourceId, SCHEMA.resource.id),
                    ne(statusRankSubquery.status, JobStatus.Successful),
                    eq(statusRankSubquery.rank, 1),
                    eq(statusRankSubquery.systemId, environment.systemId),
                  ),
                )
                .limit(1),
            ),
            isNull(SCHEMA.resource.deletedAt),
            SCHEMA.resourceMatchesMetadata(ctx.db, environment.resourceSelector),
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
          SCHEMA.releaseJobTrigger,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseJobTrigger.environmentId, input.environmentId),
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
