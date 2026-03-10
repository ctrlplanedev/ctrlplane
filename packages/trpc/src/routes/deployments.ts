import { TRPCError } from "@trpc/server";
import { parse } from "cel-js";
import { isPresent } from "ts-is-present";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, asc, desc, eq, inArray, sql, takeFirst } from "@ctrlplane/db";
import {
  enqueueDeploymentSelectorEval,
  enqueuePolicyEval,
  enqueueReleaseTargetsForDeployment,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

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
        .innerJoin(
          schema.computedEnvironmentResource,
          and(
            eq(
              schema.computedEnvironmentResource.environmentId,
              schema.environment.id,
            ),
            eq(
              schema.computedEnvironmentResource.resourceId,
              schema.resource.id,
            ),
          ),
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
          sql`${schema.job.completedAt} desc nulls last`,
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
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, deploymentId, jobAgentId, jobAgentConfig } = input;

      const getTypedJobAgentConfig = (
        config: z.infer<typeof deploymentJobAgentConfig>,
      ) => {
        const ghResult = deploymentGhConfig.safeParse(config);
        if (ghResult.success)
          return { ...ghResult.data, type: "github-app" as const };
        const argoCdResult = deploymentArgoCdConfig.safeParse(config);
        if (argoCdResult.success)
          return { ...argoCdResult.data, type: "argo-cd" as const };
        const tfeResult = deploymentTfeConfig.safeParse(config);
        if (tfeResult.success)
          return { ...tfeResult.data, type: "tfe" as const };
        return { ...config, type: "custom" as const };
      };

      const typedConfig = getTypedJobAgentConfig(jobAgentConfig);

      const [updated] = await ctx.db
        .update(schema.deployment)
        .set({ jobAgentId, jobAgentConfig: typedConfig })
        .where(eq(schema.deployment.id, deploymentId))
        .returning();

      if (updated == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      await Promise.all([
        enqueueDeploymentSelectorEval(ctx.db, { workspaceId, deploymentId }),
        enqueueReleaseTargetsForDeployment(ctx.db, workspaceId, deploymentId),
      ]);

      return updated;
    }),

  variables: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), deploymentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const variables = await ctx.db.query.deploymentVariable.findMany({
        where: eq(schema.deploymentVariable.deploymentId, input.deploymentId),
      });

      const variableIds = variables.map((v) => v.id);
      const values =
        variableIds.length > 0
          ? await ctx.db.query.deploymentVariableValue.findMany({
              where: inArray(
                schema.deploymentVariableValue.deploymentVariableId,
                variableIds,
              ),
            })
          : [];

      const valuesByVarId = new Map<
        string,
        (typeof schema.deploymentVariableValue.$inferSelect)[]
      >();
      for (const val of values) {
        const arr = valuesByVarId.get(val.deploymentVariableId) ?? [];
        arr.push(val);
        valuesByVarId.set(val.deploymentVariableId, arr);
      }

      return variables.map((variable) => ({
        variable,
        values: valuesByVarId.get(variable.id) ?? [],
      }));
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
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, ...versionData } = input;
      const name =
        versionData.name == null || versionData.name === ""
          ? versionData.tag
          : versionData.name;
      const version = {
        id: uuidv4(),
        ...versionData,
        name,
        metadata: {} as Record<string, string>,
        createdAt: new Date(),
      };

      const insertedVersion = await ctx.db.transaction(async (tx) => {
        const insertedVersion = await tx
          .insert(schema.deploymentVersion)
          .values(version)
          .onConflictDoNothing()
          .returning()
          .then(takeFirst);
        await enqueueReleaseTargetsForDeployment(
          tx,
          workspaceId,
          insertedVersion.deploymentId,
        );
        await enqueuePolicyEval(tx, workspaceId, insertedVersion.id);
        return insertedVersion;
      });

      return insertedVersion;
    }),

  deleteVariable: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        deploymentId: z.string(),
        variableId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, deploymentId, variableId } = input;

      const variable = await ctx.db.query.deploymentVariable.findFirst({
        where: and(
          eq(schema.deploymentVariable.id, variableId),
          eq(schema.deploymentVariable.deploymentId, deploymentId),
        ),
      });

      if (variable == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment variable not found",
        });

      await ctx.db
        .delete(schema.deploymentVariable)
        .where(eq(schema.deploymentVariable.id, variableId));

      await enqueueReleaseTargetsForDeployment(
        ctx.db,
        workspaceId,
        deploymentId,
      );

      return { success: true };
    }),

  policies: protectedProcedure
    .input(z.object({ workspaceId: z.string(), deploymentId: z.string() }))
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .select({
          policyId: schema.computedPolicyReleaseTarget.policyId,
          resourceId: schema.computedPolicyReleaseTarget.resourceId,
          environmentId: schema.computedPolicyReleaseTarget.environmentId,
          deploymentId: schema.computedPolicyReleaseTarget.deploymentId,
        })
        .from(schema.computedPolicyReleaseTarget)
        .where(
          eq(
            schema.computedPolicyReleaseTarget.deploymentId,
            input.deploymentId,
          ),
        );

      const policyIds = [...new Set(rows.map((r) => r.policyId))];
      if (policyIds.length === 0) return [];

      const releaseTargetsByPolicy = new Map<
        string,
        { resourceId: string; environmentId: string; deploymentId: string }[]
      >();
      for (const row of rows) {
        const arr = releaseTargetsByPolicy.get(row.policyId) ?? [];
        arr.push({
          resourceId: row.resourceId,
          environmentId: row.environmentId,
          deploymentId: row.deploymentId,
        });
        releaseTargetsByPolicy.set(row.policyId, arr);
      }

      const policies = await ctx.db.query.policy.findMany({
        where: inArray(schema.policy.id, policyIds),
        with: {
          anyApprovalRules: true,
          deploymentDependencyRules: true,
          deploymentWindowRules: true,
          environmentProgressionRules: true,
          gradualRolloutRules: true,
          retryRules: true,
          rollbackRules: true,
          verificationRules: true,
          versionCooldownRules: true,
          versionSelectorRules: true,
        },
      });

      return policies.map((p) => {
        const rules = [
          ...p.anyApprovalRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            anyApproval: { minApprovals: r.minApprovals },
          })),
          ...p.deploymentDependencyRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            deploymentDependency: { dependsOn: r.dependsOn },
          })),
          ...p.deploymentWindowRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            deploymentWindow: {
              allowWindow: r.allowWindow,
              durationMinutes: r.durationMinutes,
              rrule: r.rrule,
              timezone: r.timezone,
            },
          })),
          ...p.environmentProgressionRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            environmentProgression: {
              dependsOnEnvironmentSelector: r.dependsOnEnvironmentSelector,
              maximumAgeHours: r.maximumAgeHours,
              minimumSoakTimeMinutes: r.minimumSoakTimeMinutes,
              minimumSuccessPercentage: r.minimumSuccessPercentage,
              successStatuses: r.successStatuses,
            },
          })),
          ...p.gradualRolloutRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            gradualRollout: {
              rolloutType: r.rolloutType,
              timeScaleInterval: r.timeScaleInterval,
            },
          })),
          ...p.retryRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            retry: {
              maxRetries: r.maxRetries,
              backoffSeconds: r.backoffSeconds,
              backoffStrategy: r.backoffStrategy,
              maxBackoffSeconds: r.maxBackoffSeconds,
              retryOnStatuses: r.retryOnStatuses,
            },
          })),
          ...p.rollbackRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            rollback: {
              onJobStatuses: r.onJobStatuses,
              onVerificationFailure: r.onVerificationFailure,
            },
          })),
          ...p.verificationRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            verification: {
              metrics: r.metrics,
              triggerOn: r.triggerOn,
            },
          })),
          ...p.versionCooldownRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            versionCooldown: { intervalSeconds: r.intervalSeconds },
          })),
          ...p.versionSelectorRules.map((r) => ({
            id: r.id,
            policyId: r.policyId,
            createdAt: r.createdAt.toISOString(),
            versionSelector: {
              description: r.description,
              selector: r.selector,
            },
          })),
        ];

        const environmentIds =
          p.environmentProgressionRules.length > 0
            ? [
                ...new Set(
                  rows
                    .filter((r) => r.policyId === p.id)
                    .map((r) => r.environmentId),
                ),
              ]
            : [];

        return {
          policy: {
            id: p.id,
            name: p.name,
            description: p.description ?? undefined,
            selector: p.selector,
            metadata: p.metadata,
            priority: p.priority,
            enabled: p.enabled,
            workspaceId: p.workspaceId,
            createdAt: p.createdAt.toISOString(),
            rules,
          },
          environmentIds,
          releaseTargets: releaseTargetsByPolicy.get(p.id) ?? [],
        };
      });
    }),
});
