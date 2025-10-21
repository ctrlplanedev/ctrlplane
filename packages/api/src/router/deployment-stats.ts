import { eachDayOfInterval, format, subDays } from "date-fns";
import _ from "lodash-es";
import { z } from "zod";

import {
  and,
  count,
  countDistinct,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  or,
  sql,
  takeFirst,
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

const successRate = (startDate: Date, endDate: Date) => sql<number | null>`
  CAST(
    SUM(
      CASE 
        WHEN ${schema.job.status} = ${JobStatus.Successful} 
        AND ${schema.job.createdAt} BETWEEN ${startDate} AND ${endDate}
        THEN 1 
        ELSE 0 
      END
    ) AS FLOAT
  ) / 
  NULLIF(COUNT(*) FILTER (WHERE ${schema.job.createdAt} BETWEEN ${startDate} AND ${endDate}), 0) * 100
`;

const totalDuration = (startDate: Date, endDate: Date) => sql<number | null>`
  SUM(
    CASE 
      WHEN ${schema.job.completedAt} IS NOT NULL 
      AND ${schema.job.startedAt} IS NOT NULL 
      AND ${schema.job.createdAt} BETWEEN ${startDate} AND ${endDate}
      THEN EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
    END
  )::integer
`;

export const deploymentStatsRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) => {
        if ("workspaceId" in input)
          return canUser
            .perform(Permission.DeploymentList)
            .on({ type: "workspace", id: input.workspaceId });
        if ("systemId" in input)
          return canUser
            .perform(Permission.DeploymentList)
            .on({ type: "system", id: input.systemId });

        if ("environmentId" in input)
          return canUser
            .perform(Permission.EnvironmentGet)
            .on({ type: "environment", id: input.environmentId });

        if ("resourceId" in input)
          return canUser
            .perform(Permission.ResourceGet)
            .on({ type: "resource", id: input.resourceId });

        return false;
      },
    })
    .input(
      z
        .object({
          startDate: z.date(),
          endDate: z.date(),
          timezone: z.string(),
          orderBy: statsColumn.default(StatsColumn.LastRunAt),
          order: statsOrder.default(StatsOrder.Desc),
          search: z.string().optional(),
        })
        .and(
          z
            .object({ workspaceId: z.string().uuid() })
            .or(z.object({ systemId: z.string().uuid() }))
            .or(z.object({ environmentId: z.string().uuid() }))
            .or(z.object({ resourceId: z.string().uuid() })),
        ),
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate, orderBy, order, search } = input;
      const orderFunc = (field: unknown) =>
        order === StatsOrder.Asc
          ? sql`${field} ASC NULLS LAST`
          : sql`${field} DESC NULLS LAST`;

      const getUUIDCheck = () => {
        if ("workspaceId" in input)
          return eq(schema.system.workspaceId, input.workspaceId);
        if ("systemId" in input) return eq(schema.system.id, input.systemId);
        if ("environmentId" in input)
          return eq(schema.releaseTarget.environmentId, input.environmentId);
        return eq(schema.releaseTarget.resourceId, input.resourceId);
      };

      const lastRunAt = max(schema.job.startedAt);
      const totalJobs = count(schema.job.id);

      const p50 = sql<number | null>`
        percentile_cont(0.5) within group (order by 
          EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
        ) FILTER (WHERE ${schema.job.completedAt} IS NOT NULL AND ${schema.job.startedAt} IS NOT NULL AND ${schema.job.createdAt} BETWEEN ${startDate} AND ${endDate})
      `;

      const p90 = sql<number | null>`
        percentile_cont(0.9) within group (order by 
          EXTRACT(EPOCH FROM (${schema.job.completedAt} - ${schema.job.startedAt}))
        ) FILTER (WHERE ${schema.job.completedAt} IS NOT NULL AND ${schema.job.startedAt} IS NOT NULL AND ${schema.job.createdAt} BETWEEN ${startDate} AND ${endDate})
      `;

      const totalSuccess = sql<number>`
        (COUNT(*) FILTER (WHERE ${schema.job.status} = ${JobStatus.Successful} AND ${schema.job.createdAt} BETWEEN ${startDate} AND ${endDate}))::integer
      `;

      const associatedResources = countDistinct(
        schema.releaseTarget.resourceId,
      );

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

      // we want to show all deployments in the views, even if they are inactive
      const activeDeploymentChecks = and(
        isNotNull(schema.job.completedAt),
        isNotNull(schema.job.startedAt),
        isNull(schema.resource.deletedAt),
        search ? ilike(schema.deployment.name, `%${search}%`) : undefined,
      );

      const inactiveDeploymentChecks = or(
        isNull(schema.job),
        isNull(schema.deploymentVersion),
        isNull(schema.releaseTarget),
      );

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
          totalDuration: totalDuration(startDate, endDate),
          associatedResources,
          successRate: successRate(startDate, endDate),
          p50,
          p90,
        })
        .from(schema.deployment)
        .leftJoin(
          schema.deploymentVersion,
          eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
        )
        .leftJoin(
          schema.versionRelease,
          eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
        )
        .leftJoin(
          schema.releaseTarget,
          eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
        )
        .leftJoin(
          schema.resource,
          eq(schema.releaseTarget.resourceId, schema.resource.id),
        )
        .leftJoin(
          schema.release,
          eq(schema.release.versionReleaseId, schema.versionRelease.id),
        )
        .leftJoin(
          schema.releaseJob,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .leftJoin(schema.job, eq(schema.job.id, schema.releaseJob.jobId))
        .innerJoin(
          schema.system,
          eq(schema.system.id, schema.deployment.systemId),
        )
        .where(
          and(
            getUUIDCheck(),
            or(activeDeploymentChecks, inactiveDeploymentChecks),
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

  totals: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        startDate: z.date(),
        endDate: z.date(),
      }),
    )
    .query(({ ctx, input }) => {
      const { startDate, endDate } = input;

      return ctx.db
        .select({
          totalJobs: count(schema.job.id),
          successRate: successRate(startDate, endDate),
        })
        .from(schema.job)
        .innerJoin(
          schema.releaseJob,
          eq(schema.releaseJob.jobId, schema.job.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJob.releaseId, schema.release.id),
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
          schema.deployment,
          eq(schema.deploymentVersion.deploymentId, schema.deployment.id),
        )
        .innerJoin(
          schema.system,
          eq(schema.system.id, schema.deployment.systemId),
        )
        .where(
          and(
            eq(schema.system.workspaceId, input.workspaceId),
            gte(schema.job.createdAt, startDate),
            lte(schema.job.createdAt, endDate),
            isNotNull(schema.job.completedAt),
            isNotNull(schema.job.startedAt),
          ),
        )
        .then(takeFirst);
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
          schema.releaseJob,
          eq(schema.releaseJob.jobId, schema.job.id),
        )
        .innerJoin(
          schema.release,
          eq(schema.releaseJob.releaseId, schema.release.id),
        )
        .innerJoin(
          schema.versionRelease,
          eq(schema.release.versionReleaseId, schema.versionRelease.id),
        )
        .innerJoin(
          schema.releaseTarget,
          eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
        )
        .innerJoin(
          schema.deploymentVersion,
          eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
        )
        .where(
          and(
            eq(schema.deploymentVersion.deploymentId, deploymentId),
            inArray(schema.job.status, analyticsStatuses),
            gte(schema.job.completedAt, startDate),
            lt(schema.job.completedAt, endDate),
            resourceId
              ? eq(schema.releaseTarget.resourceId, resourceId)
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
