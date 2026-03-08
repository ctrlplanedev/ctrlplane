import { TRPCError } from "@trpc/server";
import z from "zod";

import { and, desc, eq, inArray, sql } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

export const releaseTargetsRouter = router({
  policies: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        releaseTargetKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, releaseTargetKey } = input;
      const resp = await getClientFor(workspaceId).GET(
        "/v1/workspaces/{workspaceId}/release-targets/{releaseTargetKey}/policies",
        {
          params: { path: { workspaceId, releaseTargetKey } },
        },
      );
      if (resp.error != null)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            resp.error.error ?? "Failed to get policies for release target",
        });
      return resp.data.policies ?? [];
    }),

  evaluations: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        resourceId: z.string().uuid(),
        versionId: z.string().uuid().optional(),
        limit: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(schema.policyRuleEvaluation.environmentId, input.environmentId),
        eq(schema.policyRuleEvaluation.resourceId, input.resourceId),
      ];

      if (input.versionId != null) {
        conditions.push(
          eq(schema.policyRuleEvaluation.versionId, input.versionId),
        );
      }

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
        .where(and(...conditions))
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
      if (ruleIds.length === 0) return rows.map((r) => ({ ...r, policy: null }));

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
        const p = policyId ? policyMap.get(policyId) ?? null : null;
        return { ...r, policy: p };
      });
    }),
});
