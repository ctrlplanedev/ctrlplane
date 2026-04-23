import { TRPCError } from "@trpc/server";
import { parse } from "cel-js";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  takeFirst,
} from "@ctrlplane/db";
import {
  enqueueDeploymentSelectorEval,
  enqueuePolicyEval,
  enqueueReleaseTargetsForDeployment,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";
import { toClientVariableValue } from "./_variables.js";
import { deploymentPlansRouter } from "./deployment-plans.js";

export const deploymentsRouter = router({
  plans: deploymentPlansRouter,

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

      return deployment;
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
      return deployments;
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
    .query(async ({ input }) => {
      const result = await getClientFor().GET(
        "/v1/deployments/{deploymentId}/release-targets",
        { params: { path: { deploymentId: input.deploymentId } } },
      );

      if (result.error != null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list release targets: ${JSON.stringify(result.error)}`,
        });
      }

      return result.data.items.map((item) => ({
        ...item,
        latestJob: item.latestJob
          ? {
              ...item.latestJob,
              createdAt: new Date(item.latestJob.createdAt),
              completedAt: item.latestJob.completedAt
                ? new Date(item.latestJob.completedAt)
                : null,
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

  searchVersions: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionList)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.uuid(),
        query: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.number().min(0).default(0),
      }),
    )
    .query(async ({ input, ctx }) => {
      const search = input.query?.trim();
      return ctx.db.query.deploymentVersion.findMany({
        where: and(
          eq(schema.deploymentVersion.deploymentId, input.deploymentId),
          search
            ? or(
                ilike(schema.deploymentVersion.name, `%${search}%`),
                ilike(schema.deploymentVersion.tag, `%${search}%`),
              )
            : undefined,
        ),
        limit: input.limit,
        offset: input.cursor,
        orderBy: desc(schema.deploymentVersion.createdAt),
      });
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
        config: z.record(z.string(), z.any()).default({}),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, deploymentId, jobAgentId, config } = input;

      const deployment = await ctx.db.query.deployment.findFirst({
        where: and(
          eq(schema.deployment.id, deploymentId),
          eq(schema.deployment.workspaceId, workspaceId),
        ),
      });

      if (deployment == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });

      const jobAgent = await ctx.db.query.jobAgent.findFirst({
        where: and(
          eq(schema.jobAgent.id, jobAgentId),
          eq(schema.jobAgent.workspaceId, workspaceId),
        ),
      });

      if (jobAgent == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job agent not found in this workspace",
        });

      await ctx.db
        .update(schema.deployment)
        .set({
          jobAgentSelector: `jobAgent.id == "${jobAgentId}"`,
          jobAgentConfig: config,
        })
        .where(eq(schema.deployment.id, deploymentId));

      const [updated] = await Promise.all([
        ctx.db.query.deployment.findFirst({
          where: eq(schema.deployment.id, deploymentId),
        }),
        enqueueDeploymentSelectorEval(ctx.db, { workspaceId, deploymentId }),
        enqueueReleaseTargetsForDeployment(ctx.db, workspaceId, deploymentId),
      ]);

      return updated!;
    }),

  variables: protectedProcedure
    .input(z.object({ workspaceId: z.uuid(), deploymentId: z.string() }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .query(async ({ input, ctx }) => {
      const rows = await ctx.db
        .select({ variable: schema.variable })
        .from(schema.variable)
        .innerJoin(
          schema.deployment,
          eq(schema.variable.deploymentId, schema.deployment.id),
        )
        .where(
          and(
            eq(schema.variable.scope, "deployment"),
            eq(schema.variable.deploymentId, input.deploymentId),
            eq(schema.deployment.workspaceId, input.workspaceId),
          ),
        );
      const variables = rows.map((r) => r.variable);

      const variableIds = variables.map((v) => v.id);
      const values =
        variableIds.length > 0
          ? await ctx.db.query.variableValue.findMany({
              where: inArray(schema.variableValue.variableId, variableIds),
              orderBy: [
                desc(schema.variableValue.priority),
                asc(schema.variableValue.id),
              ],
            })
          : [];

      const valuesByVarId = new Map<
        string,
        (typeof schema.variableValue.$inferSelect)[]
      >();
      for (const val of values) {
        const arr = valuesByVarId.get(val.variableId) ?? [];
        arr.push(val);
        valuesByVarId.set(val.variableId, arr);
      }

      return variables.map((v) => ({
        variable: {
          id: v.id,
          deploymentId: v.deploymentId!,
          key: v.key,
          description: v.description,
        },
        values: (valuesByVarId.get(v.id) ?? []).map(toClientVariableValue),
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
        return insertedVersion;
      });

      await enqueueReleaseTargetsForDeployment(
        ctx.db,
        workspaceId,
        insertedVersion.deploymentId,
      );
      await enqueuePolicyEval(ctx.db, workspaceId, insertedVersion.id);

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
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVariableDelete)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, deploymentId, variableId } = input;

      const row = await ctx.db
        .select({ variable: schema.variable })
        .from(schema.variable)
        .innerJoin(
          schema.deployment,
          eq(schema.variable.deploymentId, schema.deployment.id),
        )
        .where(
          and(
            eq(schema.variable.id, variableId),
            eq(schema.variable.scope, "deployment"),
            eq(schema.variable.deploymentId, deploymentId),
            eq(schema.deployment.workspaceId, workspaceId),
          ),
        )
        .limit(1);

      if (row.length === 0)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment variable not found",
        });

      await ctx.db
        .delete(schema.variable)
        .where(eq(schema.variable.id, variableId));

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

  jobAgents: protectedProcedure
    .input(z.object({ deploymentId: z.string() }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .query(async ({ input }) => {
      const result = await getClientFor().GET(
        "/v1/deployments/{deploymentId}/job-agents",
        { params: { path: { deploymentId: input.deploymentId } } },
      );

      if (result.error != null) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to list job agents for deployment: ${JSON.stringify(result.error)}`,
        });
      }

      return result.data.items;
    }),
});
