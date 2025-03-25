import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, desc, eq, inArray, isNull, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  activeStatus,
  analyticsStatuses,
  failedStatuses,
  JobStatus,
} from "@ctrlplane/validators/jobs";
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
      const environment = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, input.environmentId))
        .then(takeFirst);

      const selector: ResourceCondition = {
        type: FilterType.Comparison,
        operator: ComparisonOperator.And,
        conditions: [environment.resourceFilter, input.filter].filter(
          isPresent,
        ),
      };

      const resources = await ctx.db
        .select()
        .from(SCHEMA.resource)
        .leftJoin(
          SCHEMA.resourceProvider,
          eq(SCHEMA.resource.providerId, SCHEMA.resourceProvider.id),
        )
        .where(
          and(
            SCHEMA.resourceMatchesMetadata(ctx.db, selector),
            isNull(SCHEMA.resource.deletedAt),
            eq(SCHEMA.resource.workspaceId, input.workspaceId),
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

      const rows = await ctx.db
        .selectDistinctOn([
          SCHEMA.releaseJobTrigger.resourceId,
          SCHEMA.deploymentVersion.deploymentId,
        ])
        .from(SCHEMA.releaseJobTrigger)
        .innerJoin(
          SCHEMA.job,
          eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
        )
        .innerJoin(
          SCHEMA.deploymentVersion,
          eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
        )
        .orderBy(
          SCHEMA.releaseJobTrigger.resourceId,
          SCHEMA.deploymentVersion.deploymentId,
          desc(SCHEMA.job.createdAt),
        )
        .where(
          and(
            inArray(
              SCHEMA.releaseJobTrigger.resourceId,
              resources.map((r) => r.id),
            ),
            eq(SCHEMA.releaseJobTrigger.environmentId, input.environmentId),
          ),
        );

      const healthByResource: Record<
        string,
        { status: "healthy" | "unhealthy" | "deploying"; successRate: number }
      > = _.chain(rows)
        .groupBy((row) => row.release_job_trigger.resourceId)
        .map((groupedRows) => {
          const { resourceId } = groupedRows[0]!.release_job_trigger;
          const statuses = groupedRows.map((r) => r.job.status);

          const completedStatuses = statuses.filter((status) =>
            analyticsStatuses.includes(status as JobStatus),
          );
          const numSuccess = completedStatuses.filter(
            (status) => status === JobStatus.Successful,
          ).length;
          const successRate =
            completedStatuses.length > 0
              ? numSuccess / completedStatuses.length
              : 0;

          const isUnhealthy = completedStatuses.some((status) =>
            failedStatuses.includes(status as JobStatus),
          );
          if (isUnhealthy)
            return [resourceId, { status: "unhealthy", successRate }];

          const isDeploying = statuses.some((status) =>
            activeStatus.includes(status as JobStatus),
          );
          if (isDeploying)
            return [resourceId, { status: "deploying", successRate }];

          return [resourceId, { status: "healthy", successRate }];
        })
        .fromPairs()
        .value();

      return resources.map((r) => ({
        ...r,
        status: healthByResource[r.id]?.status ?? "healthy",
        successRate: healthByResource[r.id]?.successRate ?? 0,
      }));
    }),
});
