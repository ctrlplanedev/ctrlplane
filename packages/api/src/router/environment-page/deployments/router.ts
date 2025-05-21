import { subDays } from "date-fns";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  takeFirst,
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

  aggregateStats: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const environmentId = input;

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

      const statsBaseQuery = (startDate: Date, endDate: Date) =>
        ctx.db
          .select({
            total: count().as("total"),
            successRate: successRate(startDate, endDate).as("successRate"),
            averageDuration: averageDuration.as("averageDuration"),
          })
          .from(SCHEMA.job)
          .innerJoin(
            SCHEMA.releaseJob,
            eq(SCHEMA.job.id, SCHEMA.releaseJob.jobId),
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
          );

      const statsInCurrentPeriod = await statsBaseQuery(
        currentPeriodStart,
        today,
      )
        .where(
          and(
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
            gte(SCHEMA.job.createdAt, currentPeriodStart),
            lt(SCHEMA.job.createdAt, today),
            inArray(SCHEMA.job.status, analyticsStatuses),
          ),
        )
        .then(takeFirst);

      const statsInPreviousPeriod = await statsBaseQuery(
        previousPeriodStart,
        currentPeriodStart,
      )
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
        )
        .where(
          and(
            gte(SCHEMA.job.createdAt, previousPeriodStart),
            lt(SCHEMA.job.createdAt, currentPeriodStart),
            or(
              isNull(SCHEMA.resource.deletedAt),
              gte(SCHEMA.resource.deletedAt, currentPeriodStart),
            ),
            inArray(SCHEMA.job.status, analyticsStatuses),
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
          ),
        )
        .then(takeFirst);

      return {
        statsInCurrentPeriod: {
          total: statsInCurrentPeriod.total,
          successRate: statsInCurrentPeriod.successRate ?? 0,
          averageDuration: Math.round(
            statsInCurrentPeriod.averageDuration ?? 0,
          ),
        },
        statsInPreviousPeriod: {
          total: statsInPreviousPeriod.total,
          successRate: statsInPreviousPeriod.successRate ?? 0,
          averageDuration: Math.round(
            statsInPreviousPeriod.averageDuration ?? 0,
          ),
        },
      };
    }),
});
