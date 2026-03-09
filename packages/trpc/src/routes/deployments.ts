import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { TRPCError } from "@trpc/server";
import { parse } from "cel-js";
import { isPresent } from "ts-is-present";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, asc, desc, eq, inArray } from "@ctrlplane/db";
import { enqueueDeploymentSelectorEval } from "@ctrlplane/db/reconcilers";
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

      const currentVersions = await ctx.db
        .selectDistinctOn(
          [
            schema.release.resourceId,
            schema.release.environmentId,
            schema.release.deploymentId,
          ],
          {
            resourceId: schema.release.resourceId,
            environmentId: schema.release.environmentId,
            deploymentId: schema.release.deploymentId,
            version: schema.deploymentVersion,
          },
        )
        .from(schema.release)
        .innerJoin(
          schema.releaseJob,
          eq(schema.release.id, schema.releaseJob.releaseId),
        )
        .innerJoin(
          schema.job,
          and(
            eq(schema.releaseJob.jobId, schema.job.id),
            eq(schema.job.status, "successful"),
          ),
        )
        .innerJoin(
          schema.deploymentVersion,
          eq(schema.release.versionId, schema.deploymentVersion.id),
        )
        .where(eq(schema.release.deploymentId, input.deploymentId))
        .orderBy(
          schema.release.resourceId,
          schema.release.environmentId,
          schema.release.deploymentId,
          desc(schema.job.completedAt),
        );

      const currentVersionMap = new Map(
        currentVersions.map((cv) => [
          `${cv.resourceId}-${cv.environmentId}-${cv.deploymentId}`,
          cv.version,
        ]),
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
        currentVersion:
          currentVersionMap.get(
            `${rt.resource.id}-${rt.environment.id}-${rt.deployment.id}`,
          ) ?? null,
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
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, systemIds, name, description, metadata } = input;

      const [dep] = await ctx.db
        .insert(schema.deployment)
        .values({
          workspaceId,
          name,
          description: description ?? "",
          metadata: metadata ?? {},
          jobAgentConfig: {},
          jobAgents: [],
        })
        .returning();

      await ctx.db.insert(schema.systemDeployment).values(
        systemIds.map((systemId) => ({
          systemId,
          deploymentId: dep!.id,
        })),
      );

      return dep;
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
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, deploymentId, data } = input;
      const cel = parse(data.resourceSelectorCel);

      if (!cel.isSuccess)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: cel.errors.join(", "),
        });

      const [deployment] = await ctx.db
        .update(schema.deployment)
        .set({ resourceSelector: data.resourceSelectorCel })
        .where(eq(schema.deployment.id, deploymentId))
        .returning();

      if (deployment == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      await enqueueDeploymentSelectorEval(ctx.db, {
        workspaceId,
        deploymentId,
      });

      return deployment;
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
