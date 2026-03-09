import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, asc, desc, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events/kafka";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const environmentRouter = router({
  get: protectedProcedure
    .input(z.object({ environmentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { environmentId } = input;

      const environment = await ctx.db.query.environment.findFirst({
        where: eq(schema.environment.id, environmentId),
        with: {
          systemEnvironments: {
            with: {
              system: true,
            },
          },
        },
      });

      return environment;
    }),

  resources: protectedProcedure
    .input(
      z.object({
        environmentId: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const resources = await ctx.db.query.computedEnvironmentResource.findMany(
        {
          where: eq(
            schema.computedEnvironmentResource.environmentId,
            input.environmentId,
          ),
          limit: input.limit,
          offset: input.offset,
        },
      );

      return resources;
    }),

  releaseTargets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        environmentId: z.string(),
        limit: z.number().min(1).max(1000).default(50),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const releaseTargets = await ctx.db
        .selectDistinctOn(
          [schema.deployment.id, schema.resource.id, schema.environment.id],
          {
            deployment: schema.deployment,
            environment: schema.environment,
            resource: schema.resource,
            desiredRelease: schema.release,
            desiredVersion: schema.deploymentVersion,
            latestJob: schema.job,
          },
        )
        .from(schema.computedDeploymentResource)
        .innerJoin(
          schema.deployment,
          eq(
            schema.computedDeploymentResource.deploymentId,
            schema.deployment.id,
          ),
        )
        .innerJoin(
          schema.resource,
          eq(schema.computedDeploymentResource.resourceId, schema.resource.id),
        )
        .innerJoin(
          schema.systemDeployment,
          eq(
            schema.computedDeploymentResource.deploymentId,
            schema.systemDeployment.deploymentId,
          ),
        )
        .innerJoin(
          schema.systemEnvironment,
          eq(
            schema.systemDeployment.systemId,
            schema.systemEnvironment.systemId,
          ),
        )
        .innerJoin(
          schema.environment,
          eq(schema.systemEnvironment.environmentId, schema.environment.id),
        )
        .leftJoin(
          schema.releaseTargetDesiredRelease,
          and(
            eq(
              schema.releaseTargetDesiredRelease.deploymentId,
              schema.deployment.id,
            ),
            eq(
              schema.releaseTargetDesiredRelease.resourceId,
              schema.resource.id,
            ),
            eq(
              schema.releaseTargetDesiredRelease.environmentId,
              schema.environment.id,
            ),
          ),
        )
        .leftJoin(
          schema.release,
          eq(
            schema.releaseTargetDesiredRelease.desiredReleaseId,
            schema.release.id,
          ),
        )
        .leftJoin(
          schema.deploymentVersion,
          eq(schema.release.versionId, schema.deploymentVersion.id),
        )
        .leftJoin(
          schema.releaseJob,
          eq(schema.release.id, schema.releaseJob.releaseId),
        )
        .leftJoin(schema.job, eq(schema.releaseJob.jobId, schema.job.id))
        .where(eq(schema.environment.id, input.environmentId))
        .orderBy(
          schema.deployment.id,
          schema.resource.id,
          schema.environment.id,
          desc(schema.job.createdAt),
        );

      const jobIds = releaseTargets
        .map((rt) => rt.latestJob?.id)
        .filter((id): id is string => id != null);

      const rows =
        jobIds.length > 0
          ? await ctx.db
              .select({
                metric: schema.jobVerificationMetricStatus,
                measurement: schema.jobVerificationMetricMeasurement,
              })
              .from(schema.jobVerificationMetricStatus)
              .leftJoin(
                schema.jobVerificationMetricMeasurement,
                eq(
                  schema.jobVerificationMetricMeasurement
                    .jobVerificationMetricStatusId,
                  schema.jobVerificationMetricStatus.id,
                ),
              )
              .where(inArray(schema.jobVerificationMetricStatus.jobId, jobIds))
              .orderBy(schema.jobVerificationMetricStatus.jobId)
          : [];

      type MetricWithMeasurements = {
        metric: typeof schema.jobVerificationMetricStatus.$inferSelect;
        measurements: Array<
          typeof schema.jobVerificationMetricMeasurement.$inferSelect
        >;
      };

      const verificationsMap = new Map<
        string,
        Map<string, MetricWithMeasurements[]>
      >();

      for (const row of rows) {
        const jobId = row.metric.jobId;
        const groupKey =
          row.metric.policyRuleVerificationMetricId ?? "ungrouped";

        let byRule = verificationsMap.get(jobId);
        if (!byRule) {
          byRule = new Map();
          verificationsMap.set(jobId, byRule);
        }

        let metrics = byRule.get(groupKey);
        if (!metrics) {
          metrics = [];
          byRule.set(groupKey, metrics);
        }

        let existing = metrics.find((m) => m.metric.id === row.metric.id);
        if (!existing) {
          existing = { metric: row.metric, measurements: [] };
          metrics.push(existing);
        }

        if (row.measurement != null) {
          existing.measurements.push(row.measurement);
        }
      }

      const buildVerifications = (jobId: string, createdAt: Date) => {
        const byRule = verificationsMap.get(jobId);
        if (!byRule) return [];

        return [...byRule.entries()].map(([groupKey, metrics]) => ({
          id: groupKey === "ungrouped" ? jobId : groupKey,
          jobId,
          createdAt,
          metrics: metrics.map((v) => ({
            ...v.metric,
            measurements: v.measurements,
          })),
        }));
      };

      return releaseTargets.map((rt) => ({
        releaseTarget: {
          resourceId: rt.resource.id,
          environmentId: rt.environment.id,
          deploymentId: rt.deployment.id,
        },
        deployment: rt.deployment,
        environment: rt.environment,
        resource: rt.resource,
        desiredVersion: rt.desiredVersion,
        currentVersion: rt.desiredVersion,
        latestJob:
          rt.latestJob != null
            ? {
                ...rt.latestJob,
                verifications: buildVerifications(
                  rt.latestJob.id,
                  rt.latestJob.createdAt,
                ),
              }
            : null,
      }));
    }),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ input, ctx }) => {
      const environments = await ctx.db.query.environment.findMany({
        where: eq(schema.environment.workspaceId, input.workspaceId),
        limit: 1000,
        offset: 0,
        with: {
          systemEnvironments: true,
        },
        orderBy: asc(schema.environment.name),
      });
      return environments;
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        environmentId: z.string(),
        metadata: z.record(z.string(), z.string()).optional(),
        data: z.object({
          resourceSelectorCel: z.string().min(1).max(255),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, environmentId, data } = input;
      const validate = await getClientFor(workspaceId).POST(
        "/v1/validate/resource-selector",
        {
          body: {
            resourceSelector: {
              cel: data.resourceSelectorCel,
            },
          },
        },
      );

      if (!validate.data?.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            Array.isArray(validate.data?.errors) &&
            validate.data.errors.length > 0
              ? validate.data.errors.join(", ")
              : "Invalid resource selector",
        });
      }

      const env = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}",
        { params: { path: { workspaceId, environmentId } } },
      );

      if (!env.data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      const updateData = {
        ...env.data,
        resourceSelector: {
          cel: data.resourceSelectorCel,
        },
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.EnvironmentUpdated,
        timestamp: Date.now(),
        data: updateData,
      });

      return env.data;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        systemIds: z.array(z.string()).min(1),
        name: z.string().min(1).max(255),
        description: z.string().max(500).optional(),
        metadata: z.record(z.string(), z.string()).optional(),
        resourceSelectorCel: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ input }) => {
      const validate = await getClientFor(input.workspaceId).POST(
        "/v1/validate/resource-selector",
        {
          body: {
            resourceSelector: {
              cel: input.resourceSelectorCel,
            },
          },
        },
      );

      if (!validate.data?.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            Array.isArray(validate.data?.errors) &&
            validate.data.errors.length > 0
              ? validate.data.errors.join(", ")
              : "Invalid resource selector",
        });
      }

      const { workspaceId, ...environmentData } = input;
      const environment = {
        id: uuidv4(),
        workspaceId,
        ...environmentData,
        description: environmentData.description ?? "",
        createdAt: new Date().toISOString(),
        resourceSelector: {
          cel: environmentData.resourceSelectorCel,
        },
        metadata: input.metadata ?? {},
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.EnvironmentCreated,
        timestamp: Date.now(),
        data: environment,
      });

      return environment;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        environmentId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, environmentId } = input;

      const env = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}",
        { params: { path: { workspaceId, environmentId } } },
      );

      if (!env.data) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      await sendGoEvent({
        workspaceId,
        eventType: Event.EnvironmentDeleted,
        timestamp: Date.now(),
        data: env.data,
      });

      return { success: true };
    }),
});
