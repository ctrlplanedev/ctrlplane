import { eachDayOfInterval, format, subDays } from "date-fns";
import _ from "lodash";
import { z } from "zod";

import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  max,
  sql,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import {
  StatsColumn,
  statsColumn,
  statsOrder,
  StatsOrder,
} from "@ctrlplane/validators/deployments";
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
        resourceId: z.string().uuid().optional(),
        startDate: z.date(),
        endDate: z.date(),
        timezone: z.string(),
        orderBy: statsColumn.default(StatsColumn.LastRunAt),
        order: statsOrder.default(StatsOrder.Desc),
        search: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const {
        workspaceId,
        resourceId,
        startDate,
        endDate,
        orderBy,
        order,
        search,
      } = input;
      const orderFunc = (field: unknown) =>
        order === StatsOrder.Asc
          ? sql`${field} ASC NULLS LAST`
          : sql`${field} DESC NULLS LAST`;

      const lastRunAt = max(schema.job.startedAt);
      const totalJobs = count(schema.job.id);

      const p50 = sql<number | null>`
        percentile_cont(0.5) within group (order by 
          EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
        ) FILTER (WHERE ${schema.job.completedAt} IS NOT NULL AND ${schema.job.startedAt} IS NOT NULL)
      `;

      const p90 = sql<number | null>`
        percentile_cont(0.9) within group (order by 
          EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
        ) FILTER (WHERE ${schema.job.completedAt} IS NOT NULL AND ${schema.job.startedAt} IS NOT NULL)
      `;

      const totalDuration = sql<number | null>`
        SUM(
          CASE 
            WHEN ${schema.job.completedAt} IS NOT NULL AND ${schema.job.startedAt} IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
          END
        )::integer
      `;

      const successRate = sql<number | null>`
        CAST(
          SUM(CASE WHEN ${schema.job.status} = ${JobStatus.Successful} THEN 1 ELSE 0 END) AS FLOAT
        ) / 
        NULLIF(COUNT(*), 0) * 100
      `;

      const totalSuccess = sql<number>`
        (COUNT(*) FILTER (WHERE ${schema.job.status} = ${JobStatus.Successful}))::integer
      `;

      const associatedResources = countDistinct(schema.resource.id);

      const getOrderBy = () => {
        if (orderBy === StatsColumn.LastRunAt) return lastRunAt;
        if (orderBy === StatsColumn.TotalJobs) return totalJobs;
        if (orderBy === StatsColumn.P50) return p50;
        if (orderBy === StatsColumn.P90) return p90;
        if (orderBy === StatsColumn.SuccessRate) return successRate;
        if (orderBy === StatsColumn.AssociatedResources)
          return associatedResources;
        return schema.deployment.name;
      };

      const results = await ctx.db
        .select({
          id: schema.deployment.id,
          name: schema.deployment.name,
          slug: schema.deployment.slug,
          systemId: schema.system.id,
          systemSlug: schema.system.slug,
          systemName: schema.system.name,
          lastRunAt,
          totalJobs,
          totalSuccess,
          totalDuration,
          associatedResources,
          successRate,
          p50,
          p90,
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
        .innerJoin(
          schema.resource,
          eq(schema.releaseJobTrigger.resourceId, schema.resource.id),
        )
        .where(
          and(
            eq(schema.system.workspaceId, workspaceId),
            gte(schema.job.createdAt, startDate),
            lte(schema.job.createdAt, endDate),
            isNull(schema.resource.deletedAt),
            search ? ilike(schema.deployment.name, `%${search}%`) : undefined,
            resourceId ? eq(schema.resource.id, resourceId) : undefined,
          ),
        )
        .orderBy(orderFunc(getOrderBy()))
        .groupBy(
          schema.deployment.id,
          schema.deployment.name,
          schema.deployment.slug,
          schema.system.id,
          schema.system.name,
          schema.system.slug,
        )
        .limit(100);

      return results;
    }),

  history: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().uuid(),
        timeZone: z.string(),
        resourceId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { deploymentId, timeZone, resourceId } = input;
      const endDate = new Date();
      const startDate = subDays(new Date(), 29);
      const dates = eachDayOfInterval({ start: startDate, end: endDate }).map(
        (date) => format(date, "yyyy-MM-dd"),
      );

      const dateExpr = sql`DATE(${schema.job.completedAt} AT TIME ZONE ${timeZone})::text`;

      const baseQuery = ctx.db
        .select({
          date: dateExpr.as("date"),
          status: schema.job.status,
          duration: sql<number>`
            EXTRACT(EPOCH FROM (${schema.job.completedAt} AT TIME ZONE ${timeZone} - ${schema.job.startedAt} AT TIME ZONE ${timeZone}))
          `.as("duration"),
        })
        .from(schema.job)
        .innerJoin(
          schema.releaseJobTrigger,
          eq(schema.releaseJobTrigger.jobId, schema.job.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJobTrigger.releaseId, schema.release.id),
        )
        .where(
          and(
            eq(schema.release.deploymentId, deploymentId),
            inArray(schema.job.status, analyticsStatuses),
            gte(schema.job.completedAt, startDate),
            lt(schema.job.completedAt, endDate),
            resourceId
              ? eq(schema.releaseJobTrigger.resourceId, resourceId)
              : undefined,
          ),
        )
        .as("base");

      const results = await ctx.db
        .select({
          date: baseQuery.date,
          successRate: sql<number>`
            CAST(
              SUM(CASE WHEN ${baseQuery.status} = ${JobStatus.Successful} THEN 1 ELSE 0 END) AS FLOAT
            ) / 
            NULLIF(COUNT(*), 0) * 100
          `.as("successRate"),
          avgDuration: sql<number>`AVG(${baseQuery.duration})`.as(
            "avgDuration",
          ),
        })
        .from(baseQuery)
        .groupBy(baseQuery.date)
        .orderBy(baseQuery.date);

      const resultMap = new Map(results.map((r) => [r.date, r]));

      return dates.map((date) => {
        const result = resultMap.get(date);
        return { date, ...result };
      });
    }),
});
