import { subDays } from "date-fns";
import _ from "lodash";
import { z } from "zod";

import { and, count, eq, gte, inArray, lte, max, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { analyticsStatuses, JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const deploymentStatsRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
        timezone: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const runStats = await ctx.db
        .select({
          id: schema.deployment.id,
          name: schema.deployment.name,
          slug: schema.deployment.slug,
          systemId: schema.system.id,
          systemSlug: schema.system.slug,
          systemName: schema.system.name,
          lastRunAt: max(schema.job.createdAt),
          totalJobs: count(schema.job.id),
          totalSuccess: sql<number>`
            (COUNT(*) FILTER (WHERE ${schema.job.status} = ${JobStatus.Successful}))::integer
          `,

          p50: sql<number>`
            percentile_cont(0.5) within group (order by 
              EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
            )
          `,

          p90: sql<number>`
            percentile_cont(0.9) within group (order by
              EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
            )
          `,
        })
        .from(schema.deployment)
        .innerJoin(
          schema.release,
          eq(schema.release.deploymentId, schema.deployment.id),
        )
        .innerJoin(
          schema.releaseJobTrigger,
          eq(schema.releaseJobTrigger.releaseId, schema.release.id),
        )
        .innerJoin(
          schema.job,
          eq(schema.job.id, schema.releaseJobTrigger.jobId),
        )
        .innerJoin(
          schema.system,
          eq(schema.system.id, schema.deployment.systemId),
        )
        .where(
          and(
            eq(schema.system.workspaceId, input.workspaceId),
            gte(schema.job.createdAt, input.startDate),
            lte(schema.job.createdAt, input.endDate),
          ),
        )
        .groupBy(
          schema.deployment.id,
          schema.deployment.name,
          schema.deployment.slug,
          schema.system.id,
          schema.system.name,
          schema.system.slug,
        )
        .limit(100);

      const dateTruncExpr = sql<Date>`date_trunc('day', ${schema.releaseJobTrigger.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE '${sql.raw(input.timezone)}')`;

      const subquery = ctx.db
        .select({
          deploymentId: schema.release.deploymentId,
          date: dateTruncExpr.as("date"),
          status: schema.job.status,
          countPerStatus: sql<number>`COUNT(*)`.as("countPerStatus"),
        })
        .from(schema.releaseJobTrigger)
        .innerJoin(
          schema.job,
          eq(schema.releaseJobTrigger.jobId, schema.job.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJobTrigger.releaseId, schema.release.id),
        )
        .innerJoin(
          schema.environment,
          eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
        )
        .innerJoin(
          schema.system,
          eq(schema.environment.systemId, schema.system.id),
        )
        .where(
          and(
            eq(schema.system.workspaceId, input.workspaceId),
            inArray(schema.job.status, analyticsStatuses),
            gte(schema.job.createdAt, subDays(new Date(), 30)),
          ),
        )
        .groupBy(dateTruncExpr, schema.job.status, schema.release.deploymentId)
        .as("sub");

      const statusCounts = await ctx.db
        .select({
          deploymentId: subquery.deploymentId,
          date: subquery.date,
          totalCount: sql<number>`SUM(${subquery.countPerStatus})`.as(
            "totalCount",
          ),
          statusCounts: sql<Record<JobStatus, number>>`
              jsonb_object_agg(${subquery.status}, ${subquery.countPerStatus})
            `.as("statusCounts"),
        })
        .from(subquery)
        .groupBy(subquery.deploymentId, subquery.date)
        .orderBy(subquery.deploymentId, subquery.date)
        .then((rows) =>
          _.chain(rows)
            .groupBy((row) => row.deploymentId)
            .map((groupedRows) => {
              const deploymentId = groupedRows[0]!.deploymentId;
              const stats = groupedRows.map((row) => ({
                date: row.date,
                totalCount: row.totalCount,
                statusCounts: row.statusCounts,
                successRate:
                  row.totalCount === 0
                    ? null
                    : (((row.statusCounts[JobStatus.Successful] as
                        | number
                        | undefined) ?? 0) /
                        row.totalCount) *
                      100,
              }));

              return {
                deploymentId,
                stats,
              };
            })
            .value(),
        );

      return runStats.map((runStat) => {
        const successRateStat = statusCounts.find(
          (stat) => stat.deploymentId === runStat.id,
        );
        return { ...runStat, successRates: successRateStat?.stats ?? [] };
      });
    }),
});
