import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  isNull,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import {
  createDashboardWidget,
  dashboardWidget,
  updateDashboardWidget,
} from "@ctrlplane/db/schema";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";
import { resourceCondition } from "@ctrlplane/validators/resources";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const dashboardWidgetRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createDashboardWidget)
    .mutation(({ ctx, input }) =>
      ctx.db
        .insert(dashboardWidget)
        .values(input)
        .onConflictDoNothing()
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: updateDashboardWidget,
      }),
    )
    .mutation(({ ctx, input: { id, data } }) =>
      ctx.db
        .update(dashboardWidget)
        .set(data)
        .where(eq(dashboardWidget.id, id)),
    ),

  delete: protectedProcedure
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.delete(dashboardWidget).where(eq(dashboardWidget.id, input)),
    ),

  data: createTRPCRouter({
    deploymentVersionDistribution: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.DeploymentGet)
            .on({ type: "deployment", id: input.deploymentId }),
      })
      .input(
        z.object({
          deploymentId: z.string().uuid(),
          environmentIds: z.array(z.string().uuid()).optional(),
        }),
      )
      .query(async ({ ctx, input: { deploymentId, environmentIds } }) => {
        const latestJobsSubquery = ctx.db
          .selectDistinctOn([schema.releaseTarget.id], {
            versionId: schema.deploymentVersion.id,
            versionTag: schema.deploymentVersion.tag,
          })
          .from(schema.releaseTarget)
          .innerJoin(
            schema.versionRelease,
            eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
          )
          .innerJoin(
            schema.deploymentVersion,
            eq(schema.versionRelease.versionId, schema.deploymentVersion.id),
          )
          .innerJoin(
            schema.release,
            eq(schema.release.versionReleaseId, schema.versionRelease.id),
          )
          .innerJoin(
            schema.releaseJob,
            eq(schema.releaseJob.releaseId, schema.release.id),
          )
          .innerJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
          .orderBy(schema.releaseTarget.id, desc(schema.job.startedAt))
          .where(
            and(
              eq(schema.releaseTarget.deploymentId, deploymentId),
              environmentIds != null
                ? inArray(schema.releaseTarget.environmentId, environmentIds)
                : undefined,
              eq(schema.job.status, JobStatus.Successful),
            ),
          )
          .as("latest_jobs");

        const versionCounts = await ctx.db
          .select({
            versionId: latestJobsSubquery.versionId,
            versionTag: latestJobsSubquery.versionTag,
            count: count(),
          })
          .from(latestJobsSubquery)
          .groupBy(latestJobsSubquery.versionId, latestJobsSubquery.versionTag);

        return versionCounts;
      }),

    pieChart: createTRPCRouter({
      resourceGrouping: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.ResourceGet)
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .input(
          z.object({
            workspaceId: z.string().uuid(),
            filter: resourceCondition.optional(),
            groupBy: z.array(z.enum(["kind", "version", "providerId"])),
          }),
        )
        .query(({ ctx, input: { workspaceId, filter, groupBy } }) => {
          const resourceConditions = schema.resourceMatchesMetadata(
            ctx.db,
            filter,
          );

          const groupByLabels = groupBy.map(
            (field) => sql<string>`${schema.resource[field]}`,
          );

          return ctx.db
            .select({
              label: sql`array_to_string(array[${sql.join(groupByLabels, sql`, `)}], ', ')`,
              count: count(),
            })
            .from(schema.resource)
            .where(
              and(
                eq(schema.resource.workspaceId, workspaceId),
                resourceConditions,
              ),
            )
            .groupBy(...groupBy.map((field) => schema.resource[field]))
            .orderBy(desc(sql<number>`count`));
        }),

      resourceMetadataGrouping: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.ResourceGet)
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .input(
          z.object({
            workspaceId: z.string().uuid(),
            filter: resourceCondition.optional(),
            keys: z.array(z.string()),
          }),
        )
        .query(async ({ ctx, input: { workspaceId, filter, keys } }) => {
          const resourceConditions = schema.resourceMatchesMetadata(
            ctx.db,
            filter,
          );

          const resourceMetadataAgg = ctx.db
            .select({
              id: schema.resource.id,
              metadata: sql<Record<string, string>>`jsonb_object_agg(
                ${schema.resourceMetadata.key},
                ${schema.resourceMetadata.value}
              )`.as("metadata"),
            })
            .from(schema.resource)
            .innerJoin(
              schema.resourceMetadata,
              and(
                eq(schema.resource.id, schema.resourceMetadata.resourceId),
                inArray(schema.resourceMetadata.key, keys),
                resourceConditions,
              ),
            )
            .where(
              and(
                eq(schema.resource.workspaceId, workspaceId),
                isNull(schema.resource.deletedAt),
              ),
            )
            .groupBy(schema.resource.id)
            .having(
              sql<number>`COUNT(DISTINCT ${schema.resourceMetadata.key}) = ${keys.length}`,
            )
            .as("resource_metadata_agg");

          const combinations = await ctx.db
            .with(resourceMetadataAgg)
            .select({
              label: resourceMetadataAgg.metadata,
              count: count(),
            })
            .from(resourceMetadataAgg)
            .groupBy(resourceMetadataAgg.metadata);

          return combinations;
        }),
    }),
  }),
});
