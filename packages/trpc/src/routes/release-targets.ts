import z from "zod";

import { and, asc, desc, eq, inArray, isNotNull, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

export const releaseTargetsRouter = router({
  policies: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        releaseTargetKey: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { releaseTargetKey } = input;

      const resourceId = releaseTargetKey.slice(0, 36);
      const environmentId = releaseTargetKey.slice(37, 73);
      const deploymentId = releaseTargetKey.slice(74, 110);

      const mappings = await ctx.db
        .selectDistinct({
          policyId: schema.computedPolicyReleaseTarget.policyId,
        })
        .from(schema.computedPolicyReleaseTarget)
        .where(
          and(
            eq(schema.computedPolicyReleaseTarget.resourceId, resourceId),
            eq(schema.computedPolicyReleaseTarget.environmentId, environmentId),
            eq(schema.computedPolicyReleaseTarget.deploymentId, deploymentId),
          ),
        );

      const policyIds = mappings.map((m) => m.policyId);
      if (policyIds.length === 0) return [];

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

        return {
          id: p.id,
          name: p.name,
          description: p.description,
          selector: p.selector,
          metadata: p.metadata,
          priority: p.priority,
          enabled: p.enabled,
          workspaceId: p.workspaceId,
          createdAt: p.createdAt.toISOString(),
          rules,
        };
      });
    }),

  evaluations: protectedProcedure
    .input(
      z.object({
        environmentId: z.string(),
        resourceId: z.uuid(),
        deploymentId: z.string(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(schema.policyRuleEvaluation.environmentId, input.environmentId),
        eq(schema.policyRuleEvaluation.resourceId, input.resourceId),
      ];

      const recentVersionRows = await ctx.db
        .selectDistinct({
          versionId: schema.policyRuleEvaluation.versionId,
          createdAt: schema.deploymentVersion.createdAt,
        })
        .from(schema.policyRuleEvaluation)
        .innerJoin(
          schema.deploymentVersion,
          eq(
            schema.policyRuleEvaluation.versionId,
            schema.deploymentVersion.id,
          ),
        )
        .where(
          and(
            ...conditions,
            eq(schema.deploymentVersion.deploymentId, input.deploymentId),
          ),
        )
        .orderBy(desc(schema.deploymentVersion.createdAt))
        .limit(input.limit);

      const versionIds = recentVersionRows.map((r) => r.versionId);
      if (versionIds.length === 0) return [];

      const rows = await ctx.db
        .select({
          evaluation: schema.policyRuleEvaluation,
          version: {
            id: schema.deploymentVersion.id,
            name: schema.deploymentVersion.name,
            tag: schema.deploymentVersion.tag,
            createdAt: schema.deploymentVersion.createdAt,
            status: schema.deploymentVersion.status,
          },
        })
        .from(schema.policyRuleEvaluation)
        .innerJoin(
          schema.deploymentVersion,
          eq(
            schema.policyRuleEvaluation.versionId,
            schema.deploymentVersion.id,
          ),
        )
        .where(
          and(
            ...conditions,
            inArray(schema.policyRuleEvaluation.versionId, versionIds),
          ),
        )
        .orderBy(
          desc(schema.deploymentVersion.createdAt),
          desc(schema.policyRuleEvaluation.evaluatedAt),
        );

      const ruleIds = [...new Set(rows.map((r) => r.evaluation.ruleId))];
      if (ruleIds.length === 0)
        return rows.map((r) => ({ ...r, policy: null }));

      const ruleTables = [
        schema.policyRuleAnyApproval,
        schema.policyRuleDeploymentDependency,
        schema.policyRuleDeploymentWindow,
        schema.policyRuleEnvironmentProgression,
        schema.policyRuleGradualRollout,
        schema.policyRuleRetry,
        schema.policyRuleRollback,
        schema.policyRuleVerification,
        schema.policyRuleVersionCooldown,
        schema.policyRuleVersionSelector,
      ] as const;

      const unions = ruleTables.map(
        (t) =>
          sql`SELECT ${t.id} AS rule_id, ${t.policyId} AS policy_id FROM ${t} WHERE ${inArray(t.id, ruleIds)}`,
      );
      const unionQuery = sql.join(unions, sql` UNION ALL `);

      const ruleRows = await ctx.db.execute<{
        rule_id: string;
        policy_id: string;
      }>(unionQuery);

      const policyIds = [...new Set(ruleRows.rows.map((r) => r.policy_id))];
      const ruleToPolicyId = new Map(
        ruleRows.rows.map((r) => [r.rule_id, r.policy_id]),
      );

      const policyMap = new Map<string, { id: string; name: string }>();
      if (policyIds.length > 0) {
        const policies = await ctx.db
          .select({ id: schema.policy.id, name: schema.policy.name })
          .from(schema.policy)
          .where(inArray(schema.policy.id, policyIds));
        for (const p of policies) policyMap.set(p.id, p);
      }

      return rows.map((r) => {
        const policyId = ruleToPolicyId.get(r.evaluation.ruleId);
        const p = policyId ? (policyMap.get(policyId) ?? null) : null;
        return { ...r, policy: p };
      });
    }),

  dependencies: protectedProcedure
    .input(
      z.object({
        deploymentId: z.uuid(),
        environmentId: z.uuid(),
        resourceId: z.uuid(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const desired = await ctx.db
        .select({
          version: {
            id: schema.deploymentVersion.id,
            tag: schema.deploymentVersion.tag,
            name: schema.deploymentVersion.name,
            status: schema.deploymentVersion.status,
            createdAt: schema.deploymentVersion.createdAt,
          },
        })
        .from(schema.releaseTargetDesiredRelease)
        .innerJoin(
          schema.release,
          eq(
            schema.releaseTargetDesiredRelease.desiredReleaseId,
            schema.release.id,
          ),
        )
        .innerJoin(
          schema.deploymentVersion,
          eq(schema.release.versionId, schema.deploymentVersion.id),
        )
        .where(
          and(
            eq(
              schema.releaseTargetDesiredRelease.deploymentId,
              input.deploymentId,
            ),
            eq(
              schema.releaseTargetDesiredRelease.environmentId,
              input.environmentId,
            ),
            eq(
              schema.releaseTargetDesiredRelease.resourceId,
              input.resourceId,
            ),
          ),
        )
        .limit(1);

      const desiredVersion = desired[0]?.version ?? null;
      const latestVersion =
        desiredVersion != null
          ? null
          : ((
              await ctx.db
                .select({
                  id: schema.deploymentVersion.id,
                  tag: schema.deploymentVersion.tag,
                  name: schema.deploymentVersion.name,
                  status: schema.deploymentVersion.status,
                  createdAt: schema.deploymentVersion.createdAt,
                })
                .from(schema.deploymentVersion)
                .where(
                  eq(schema.deploymentVersion.deploymentId, input.deploymentId),
                )
                .orderBy(desc(schema.deploymentVersion.createdAt))
                .limit(1)
            )[0] ?? null);

      const version = desiredVersion ?? latestVersion;

      if (version == null) return { version: null, dependencies: [] };

      const edges = await ctx.db
        .select({
          dependencyDeploymentId:
            schema.deploymentVersionDependency.dependencyDeploymentId,
          versionSelector: schema.deploymentVersionDependency.versionSelector,
        })
        .from(schema.deploymentVersionDependency)
        .where(
          eq(
            schema.deploymentVersionDependency.deploymentVersionId,
            version.id,
          ),
        )
        .orderBy(asc(schema.deploymentVersionDependency.dependencyDeploymentId));

      if (edges.length === 0) return { version, dependencies: [] };

      const dependencyDeploymentIds = edges.map((e) => e.dependencyDeploymentId);

      const dependencyDeployments = await ctx.db
        .select({
          id: schema.deployment.id,
          name: schema.deployment.name,
        })
        .from(schema.deployment)
        .where(inArray(schema.deployment.id, dependencyDeploymentIds));
      const deploymentById = new Map(
        dependencyDeployments.map((d) => [d.id, d]),
      );

      const dependencies = await Promise.all(
        edges.map(async (edge) => {
          const upstream = await ctx.db
            .select({
              versionId: schema.release.versionId,
              versionTag: schema.deploymentVersion.tag,
              versionName: schema.deploymentVersion.name,
              versionStatus: schema.deploymentVersion.status,
              environmentId: schema.release.environmentId,
              completedAt: schema.job.completedAt,
            })
            .from(schema.release)
            .innerJoin(
              schema.releaseJob,
              eq(schema.releaseJob.releaseId, schema.release.id),
            )
            .innerJoin(
              schema.job,
              eq(schema.job.id, schema.releaseJob.jobId),
            )
            .innerJoin(
              schema.deploymentVersion,
              eq(schema.deploymentVersion.id, schema.release.versionId),
            )
            .where(
              and(
                eq(schema.release.deploymentId, edge.dependencyDeploymentId),
                eq(schema.release.resourceId, input.resourceId),
                eq(schema.job.status, "successful"),
                isNotNull(schema.job.completedAt),
              ),
            )
            .orderBy(desc(schema.job.completedAt))
            .limit(1);

          const cur = upstream[0] ?? null;
          const dep = deploymentById.get(edge.dependencyDeploymentId) ?? null;

          return {
            dependencyDeploymentId: edge.dependencyDeploymentId,
            dependencyDeploymentName: dep?.name ?? null,
            versionSelector: edge.versionSelector,
            currentVersion:
              cur == null
                ? null
                : {
                    id: cur.versionId,
                    tag: cur.versionTag,
                    name: cur.versionName,
                    status: cur.versionStatus,
                    environmentId: cur.environmentId,
                    completedAt: cur.completedAt?.toISOString() ?? null,
                  },
          };
        }),
      );

      return { version, dependencies };
    }),
});
