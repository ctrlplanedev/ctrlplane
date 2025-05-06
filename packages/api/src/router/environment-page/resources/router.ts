import { z } from "zod";

import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  selector,
  sql,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { analyticsStatuses, JobStatus } from "@ctrlplane/validators/jobs";
import { resourceCondition } from "@ctrlplane/validators/resources";

import { createTRPCRouter, protectedProcedure } from "../../../trpc";

export const resourcesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        filter: resourceCondition.optional(),
        limit: z.number().min(1).max(1000).default(500),
        offset: z.number().min(0).default(0),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input.environmentId }),
    })
    .query(async ({ ctx, input }) => {
      const resources = await ctx.db
        .select()
        .from(SCHEMA.computedEnvironmentResource)
        .innerJoin(
          SCHEMA.resource,
          eq(SCHEMA.computedEnvironmentResource.resourceId, SCHEMA.resource.id),
        )
        .leftJoin(
          SCHEMA.resourceProvider,
          eq(SCHEMA.resource.providerId, SCHEMA.resourceProvider.id),
        )
        .where(
          and(
            isNull(SCHEMA.resource.deletedAt),
            eq(
              SCHEMA.computedEnvironmentResource.environmentId,
              input.environmentId,
            ),
            selector().query().resources().where(input.filter).sql(),
          ),
        )
        .limit(input.limit)
        .offset(input.offset)
        .then((rows) =>
          rows.map((row) => ({
            ...row.resource,
            provider: row.resource_provider,
          })),
        );

      if (resources.length === 0) return [];

      const latestJobSubquery = ctx.db
        .selectDistinctOn([SCHEMA.versionRelease.releaseTargetId], {
          jobId: SCHEMA.job.id,
          jobStatus: SCHEMA.job.status,
          releaseTargetId: SCHEMA.versionRelease.releaseTargetId,
        })
        .from(SCHEMA.versionRelease)
        .innerJoin(
          SCHEMA.release,
          eq(SCHEMA.versionRelease.id, SCHEMA.release.versionReleaseId),
        )
        .innerJoin(
          SCHEMA.releaseJob,
          eq(SCHEMA.release.id, SCHEMA.releaseJob.releaseId),
        )
        .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
        .orderBy(
          SCHEMA.versionRelease.releaseTargetId,
          desc(SCHEMA.job.createdAt),
        )
        .as("latest_job");

      const releaseTargetStats = await ctx.db
        .select({
          successRate: sql<number>`
            CASE
              WHEN COUNT(*) FILTER (
                WHERE ${and(
                  inArray(latestJobSubquery.jobStatus, analyticsStatuses),
                  isNotNull(latestJobSubquery.jobStatus),
                )}
              ) = 0
              THEN 0
              ELSE
                100.0 * COUNT(*) FILTER (
                  WHERE ${eq(latestJobSubquery.jobStatus, JobStatus.Successful)}
                )::float
                /
                COUNT(*) FILTER (
                  WHERE ${and(
                    inArray(latestJobSubquery.jobStatus, analyticsStatuses),
                    isNotNull(latestJobSubquery.jobStatus),
                  )}
                )
            END
        `.as("successRate"),
          resourceId: SCHEMA.releaseTarget.resourceId,
          isDeploying: sql<boolean>`
            BOOL_OR(${eq(latestJobSubquery.jobStatus, JobStatus.InProgress)})
          `.as("isDeploying"),
        })
        .from(SCHEMA.releaseTarget)
        .leftJoin(
          latestJobSubquery,
          eq(latestJobSubquery.releaseTargetId, SCHEMA.releaseTarget.id),
        )
        .where(
          and(
            eq(SCHEMA.releaseTarget.environmentId, input.environmentId),
            inArray(
              SCHEMA.releaseTarget.resourceId,
              resources.map((r) => r.id),
            ),
          ),
        )
        .groupBy(SCHEMA.releaseTarget.resourceId);

      return resources.map((r) => ({
        ...r,
        successRate:
          releaseTargetStats.find((s) => s.resourceId === r.id)?.successRate ??
          0,
        isDeploying:
          releaseTargetStats.find((s) => s.resourceId === r.id)?.isDeploying ??
          false,
      }));
    }),
});
