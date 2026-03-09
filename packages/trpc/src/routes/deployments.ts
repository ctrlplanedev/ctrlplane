import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { TRPCError } from "@trpc/server";
import { isPresent } from "ts-is-present";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, asc, desc, eq, inArray } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Event, sendGoEvent } from "@ctrlplane/events/kafka";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

const deploymentGhConfig = z.object({
  repo: z.string(),
  workflowId: z.coerce.number(),
  ref: z.string().optional(),
});

const deploymentArgoCdConfig = z.object({
  template: z.string(),
});

const deploymentTfeConfig = z.object({
  template: z.string(),
});

const deploymentCustomConfig = z.object({}).passthrough();

const deploymentJobAgentConfig = z.union([
  deploymentGhConfig,
  deploymentArgoCdConfig,
  deploymentTfeConfig,
  deploymentCustomConfig,
]);

const getAgentsArrayWithLegacyAgent = (
  deployment: typeof schema.deployment.$inferSelect,
) => {
  const agentsArray = deployment.jobAgents;
  const agentsArrayWithLegacyAgent = [
    ...agentsArray,
    deployment.jobAgentId != null &&
    deployment.jobAgentId !== "" &&
    deployment.jobAgentId !== "00000000-0000-0000-0000-000000000000"
      ? {
          ref: deployment.jobAgentId,
          config: deployment.jobAgentConfig,
          selector: "true",
        }
      : null,
  ].filter(isPresent);
  return agentsArrayWithLegacyAgent;
};

export const deploymentsRouter = router({
  get: protectedProcedure
    .input(z.object({ deploymentId: z.uuid() }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .query(async ({ input, ctx }) => {
      const deployment = await ctx.db.query.deployment.findFirst({
        where: eq(schema.deployment.id, input.deploymentId),
        with: {
          systemDeployments: {
            with: {
              system: {
                with: {
                  systemEnvironments: true,
                },
              },
            },
          },
        },
      });

      if (deployment == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      return {
        ...deployment,
        jobAgents: getAgentsArrayWithLegacyAgent(deployment),
      };
    }),

  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .query(async ({ input, ctx }) => {
      const deployments = await ctx.db.query.deployment.findMany({
        where: eq(schema.deployment.workspaceId, input.workspaceId),
        limit: 1000,
        offset: 0,
        with: {
          systemDeployments: {
            with: {
              system: true,
            },
          },
        },
        orderBy: asc(schema.deployment.name),
      });
      return deployments.map((deployment) => ({
        ...deployment,
        jobAgents: getAgentsArrayWithLegacyAgent(deployment),
      }));
    }),

  releaseTargets: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseTargetGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.string(),
        query: z.string().optional(),
        limit: z.number().min(1).max(1000).default(1000),
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
        .where(eq(schema.deployment.id, input.deploymentId))
        .orderBy(
          schema.deployment.id,
          schema.resource.id,
          schema.environment.id,
          desc(schema.job.createdAt),
        );

      const jobIds = releaseTargets
        .map((rt) => rt.latestJob?.id)
        .filter((id): id is string => id != null);

      const rows = await ctx.db
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
        .orderBy(schema.jobVerificationMetricStatus.jobId);

      type MetricWithMeasurements = {
        metric: typeof schema.jobVerificationMetricStatus.$inferSelect;
        measurements: Array<
          typeof schema.jobVerificationMetricMeasurement.$inferSelect
        >;
      };

      // Group: jobId -> policyRuleVerificationMetricId (or "ungrouped") -> metrics
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

  versions: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionList)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.uuid(),
        limit: z.number().min(1).max(1000).default(1000),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const versions = await ctx.db.query.deploymentVersion.findMany({
        where: eq(schema.deploymentVersion.deploymentId, input.deploymentId),
        limit: input.limit,
        offset: input.offset,
        orderBy: desc(schema.deploymentVersion.createdAt),
      });

      return versions;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        systemIds: z.array(z.string()).min(1),
        name: z.string().min(3).max(255),
        slug: z.string().min(3).max(255),
        description: z.string().max(255).optional(),
        metadata: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId: _, ...deploymentData } = input;
      const deployment = { id: uuidv4(), ...deploymentData };

      await sendGoEvent({
        workspaceId: input.workspaceId,
        eventType: Event.DeploymentCreated,
        timestamp: Date.now(),
        data: {
          ...deployment,
          jobAgentConfig: {},
          metadata: input.metadata ?? {},
        },
      });

      return deployment;
    }),

  update: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        deploymentId: z.string(),
        data: z.object({
          resourceSelectorCel: z.string().min(1).max(512),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, deploymentId, data } = input;
      const validate = await getClientFor(workspaceId).POST(
        "/v1/validate/resource-selector",
        {
          body: { resourceSelector: { cel: data.resourceSelectorCel } },
        },
      );

      if (!validate.data?.valid)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            Array.isArray(validate.data?.errors) &&
            validate.data.errors.length > 0
              ? validate.data.errors.join(", ")
              : "Invalid resource selector",
        });

      const deployment = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        { params: { path: { workspaceId, deploymentId } } },
      );

      if (!deployment.data)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      const resourceSelector = { cel: data.resourceSelectorCel };
      const updateData: WorkspaceEngine["schemas"]["Deployment"] = {
        ...deployment.data.deployment,
        resourceSelector,
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentUpdated,
        timestamp: Date.now(),
        data: updateData,
      });

      return deployment.data;
    }),

  updateJobAgent: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        deploymentId: z.string(),
        jobAgentId: z.string(),
        jobAgentConfig: deploymentJobAgentConfig,
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, deploymentId, jobAgentId, jobAgentConfig } = input;
      const deployment = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        { params: { path: { workspaceId, deploymentId } } },
      );

      if (!deployment.data) throw new Error("Deployment not found");

      const getTypedJobAgentConfig = (
        config: z.infer<typeof deploymentJobAgentConfig>,
      ) => {
        const ghResult = deploymentGhConfig.safeParse(config);
        if (ghResult.success) {
          return { ...ghResult.data, type: "github-app" as const };
        }
        const argoCdResult = deploymentArgoCdConfig.safeParse(config);
        if (argoCdResult.success) {
          return { ...argoCdResult.data, type: "argo-cd" as const };
        }
        const tfeResult = deploymentTfeConfig.safeParse(config);
        if (tfeResult.success) {
          return { ...tfeResult.data, type: "tfe" as const };
        }
        return { ...config, type: "custom" as const };
      };

      const updateData: WorkspaceEngine["schemas"]["Deployment"] = {
        ...deployment.data.deployment,
        jobAgentId,
        jobAgentConfig: getTypedJobAgentConfig(jobAgentConfig),
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentUpdated,
        timestamp: Date.now(),
        data: updateData,
      });

      return updateData;
    }),

  variables: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), deploymentId: z.string() }))
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        {
          params: {
            path: {
              workspaceId: input.workspaceId,
              deploymentId: input.deploymentId,
            },
          },
        },
      );
      return response.data?.variables ?? [];
    }),

  createVersion: protectedProcedure
    .input(
      z.object({
        workspaceId: z.uuid(),
        deploymentId: z.string(),
        tag: z.string().min(1),
        name: z.string().optional(),
        status: z
          .enum(["building", "ready", "failed", "rejected"])
          .default("ready"),
        message: z.string().optional(),
        config: z.record(z.string(), z.any()).default({}),
        jobAgentConfig: z.record(z.string(), z.any()).default({}),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .mutation(async ({ input }) => {
      const { workspaceId, ...versionData } = input;
      const version = {
        id: uuidv4(),
        ...versionData,
        name: versionData.name ?? versionData.tag,
        metadata: {} as Record<string, string>,
        createdAt: new Date().toISOString(),
      };

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentVersionCreated,
        timestamp: Date.now(),
        data: version,
      });

      return version;
    }),

  deleteVariable: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        deploymentId: z.string(),
        variableId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const { workspaceId, deploymentId, variableId } = input;

      const deployment = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}",
        { params: { path: { workspaceId, deploymentId } } },
      );

      if (!deployment.data)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      const variable = deployment.data.variables.find(
        (v) => v.variable.id === variableId,
      );

      if (!variable)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment variable not found",
        });

      await sendGoEvent({
        workspaceId,
        eventType: Event.DeploymentVariableDeleted,
        timestamp: Date.now(),
        data: variable.variable,
      });

      return { success: true };
    }),

  policies: protectedProcedure
    .input(z.object({ workspaceId: z.string(), deploymentId: z.string() }))
    .query(async ({ input }) => {
      const response = await getClientFor(input.workspaceId).GET(
        "/v1/workspaces/{workspaceId}/deployments/{deploymentId}/policies",
        {
          params: {
            path: input,
          },
        },
      );
      return response.data?.items ?? [];
    }),
});
