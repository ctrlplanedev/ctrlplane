import { subDays } from "date-fns";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { analyticsStatuses, JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../../../trpc";
import { getDeploymentStats } from "./deployment-stats";

export const deploymentsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        search: z.string().optional(),
        status: z
          .enum(["pending", "failed", "deploying", "success"])
          .optional(),
        orderBy: z.enum(["recent", "oldest", "duration", "success"]).optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input.environmentId }),
    })
    .query(async ({ ctx, input }) => {
      const { environmentId, workspaceId, search, status, orderBy } = input;

      const environment = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, environmentId))
        .then(takeFirst);

      const deployments = await ctx.db
        .select()
        .from(SCHEMA.deployment)
        .where(
          and(
            eq(SCHEMA.deployment.systemId, environment.systemId),
            search != null
              ? ilike(SCHEMA.deployment.name, `%${search}%`)
              : undefined,
          ),
        );

      const deploymentStats = await Promise.all(
        deployments.map((deployment) =>
          getDeploymentStats(
            ctx.db,
            environment,
            deployment,
            workspaceId,
            status,
          ),
        ),
      )
        .then((stats) => stats.filter(isPresent))
        .then((stats) => {
          if (orderBy == "recent")
            return stats.sort(
              (a, b) => b.deployedAt.getTime() - a.deployedAt.getTime(),
            );
          if (orderBy == "oldest")
            return stats.sort(
              (a, b) => a.deployedAt.getTime() - b.deployedAt.getTime(),
            );
          if (orderBy == "duration")
            return stats.sort((a, b) => b.duration - a.duration);
          if (orderBy == "success")
            return stats.sort((a, b) => b.successRate - a.successRate);
          return stats;
        });

      return deploymentStats;
    }),

  total: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        workspaceId: z.string().uuid(),
      }),
    )
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const environment = await ctx.db
          .select()
          .from(SCHEMA.environment)
          .where(eq(SCHEMA.environment.id, input.environmentId))
          .then(takeFirstOrNull);

        if (environment == null) return false;

        return canUser
          .perform(Permission.DeploymentList)
          .on({ type: "system", id: environment.systemId });
      },
    })
    .query(async ({ ctx, input }) => {
      const { environmentId, workspaceId } = input;
      const today = new Date();
      const currentPeriodStart = subDays(today, 30);
      const previousPeriodStart = subDays(today, 60);

      const deploymentsInCurrentPeriodPromise = ctx.db
        .selectDistinctOn([
          SCHEMA.releaseJobTrigger.resourceId,
          SCHEMA.deploymentVersion.deploymentId,
        ])
        .from(SCHEMA.releaseJobTrigger)
        .innerJoin(
          SCHEMA.deploymentVersion,
          eq(SCHEMA.deploymentVersion.id, SCHEMA.releaseJobTrigger.versionId),
        )
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
            gte(SCHEMA.releaseJobTrigger.createdAt, currentPeriodStart),
            isNull(SCHEMA.resource.deletedAt),
            eq(SCHEMA.resource.workspaceId, workspaceId),
          ),
        );

      const deploymentsInPreviousPeriodPromise = ctx.db
        .selectDistinctOn([
          SCHEMA.releaseJobTrigger.resourceId,
          SCHEMA.deploymentVersion.deploymentId,
        ])
        .from(SCHEMA.releaseJobTrigger)
        .innerJoin(
          SCHEMA.deploymentVersion,
          eq(SCHEMA.deploymentVersion.id, SCHEMA.releaseJobTrigger.versionId),
        )
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
            gte(SCHEMA.releaseJobTrigger.createdAt, previousPeriodStart),
            lt(SCHEMA.releaseJobTrigger.createdAt, currentPeriodStart),
            or(
              isNull(SCHEMA.resource.deletedAt),
              gte(SCHEMA.resource.deletedAt, currentPeriodStart),
            ),
            eq(SCHEMA.resource.workspaceId, workspaceId),
          ),
        );

      const [deploymentsInCurrentPeriod, deploymentsInPreviousPeriod] =
        await Promise.all([
          deploymentsInCurrentPeriodPromise,
          deploymentsInPreviousPeriodPromise,
        ]);

      return {
        deploymentsInCurrentPeriod: deploymentsInCurrentPeriod.length,
        deploymentsInPreviousPeriod: deploymentsInPreviousPeriod.length,
      };
    }),

  aggregateStats: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { environmentId, workspaceId } = input;

      const today = new Date();
      const currentPeriodStart = subDays(today, 30);
      const previousPeriodStart = subDays(today, 60);

      const successRate = (startDate: Date, endDate: Date) => sql<
        number | null
      >`
        CAST(
          SUM(
            CASE 
              WHEN ${SCHEMA.job.status} = ${JobStatus.Successful} 
              THEN 1 
              ELSE 0 
            END
          ) AS FLOAT
        ) / 
        NULLIF(COUNT(*) FILTER (WHERE ${SCHEMA.job.createdAt} BETWEEN ${startDate} AND ${endDate}), 0) * 100
      `;

      const averageDuration = sql<number | null>`
        AVG(
          CASE 
            WHEN ${SCHEMA.job.startedAt} IS NOT NULL AND ${SCHEMA.job.completedAt} IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (${SCHEMA.job.completedAt} - ${SCHEMA.job.startedAt}))
            ELSE NULL 
          END
        )
      `;

      const statsInCurrentPeriod = await ctx.db
        .select({
          successRate: successRate(currentPeriodStart, today),
          averageDuration: averageDuration,
        })
        .from(SCHEMA.releaseJobTrigger)
        .innerJoin(
          SCHEMA.job,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
            gte(SCHEMA.job.createdAt, currentPeriodStart),
            lt(SCHEMA.job.createdAt, today),
            eq(SCHEMA.resource.workspaceId, workspaceId),
            isNull(SCHEMA.resource.deletedAt),
            inArray(SCHEMA.job.status, analyticsStatuses),
          ),
        )
        .then(takeFirst);

      const statsInPreviousPeriod = await ctx.db
        .select({
          successRate: successRate(previousPeriodStart, currentPeriodStart),
          averageDuration: averageDuration,
        })
        .from(SCHEMA.releaseJobTrigger)
        .innerJoin(
          SCHEMA.job,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
            gte(SCHEMA.job.createdAt, previousPeriodStart),
            lt(SCHEMA.job.createdAt, currentPeriodStart),
            eq(SCHEMA.resource.workspaceId, workspaceId),
            or(
              isNull(SCHEMA.resource.deletedAt),
              gte(SCHEMA.resource.deletedAt, currentPeriodStart),
            ),
            inArray(SCHEMA.job.status, analyticsStatuses),
          ),
        )
        .then(takeFirst);

      return {
        statsInCurrentPeriod: {
          successRate: statsInCurrentPeriod.successRate ?? 0,
          averageDuration: Math.round(
            statsInCurrentPeriod.averageDuration ?? 0,
          ),
        },
        statsInPreviousPeriod: {
          successRate: statsInPreviousPeriod.successRate ?? 0,
          averageDuration: Math.round(
            statsInPreviousPeriod.averageDuration ?? 0,
          ),
        },
      };
    }),
});
