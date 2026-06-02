import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  and,
  eq,
  inArray,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  enqueueDesiredRelease,
  enqueueReleaseTargetsForEnvironment,
} from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

export const policySkipsRouter = router({
  forEnvAndVersion: protectedProcedure
    .input(
      z.object({
        environmentId: z.string(),
        versionId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { environmentId, versionId } = input;
      return ctx.db.query.policySkip.findMany({
        where: and(
          eq(schema.policySkip.environmentId, environmentId),
          eq(schema.policySkip.versionId, versionId),
        ),
      });
    }),

  createForEnvAndVersion: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        environmentId: z.string(),
        versionId: z.string(),
        ruleId: z.string(),
        expiresAt: z.date().optional(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, environmentId, versionId, ruleId, expiresAt } =
        input;
      const userId = ctx.session.user.id;

      const [skip] = await ctx.db
        .insert(schema.policySkip)
        .values({
          createdBy: userId,
          environmentId,
          versionId,
          ruleId,
          expiresAt,
          reason: input.reason ?? "Skipped by user",
        })
        .returning();

      await enqueueReleaseTargetsForEnvironment(
        ctx.db,
        workspaceId,
        environmentId,
      );

      return skip;
    }),

  forTarget: protectedProcedure
    .input(
      z.object({
        environmentId: z.string(),
        resourceId: z.string(),
        versionId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { environmentId, resourceId, versionId } = input;
      const skips = await ctx.db.query.policySkip.findMany({
        where: and(
          eq(schema.policySkip.environmentId, environmentId),
          eq(schema.policySkip.resourceId, resourceId),
          eq(schema.policySkip.versionId, versionId),
        ),
      });
      if (skips.length === 0) return [];

      const ruleIds = [...new Set(skips.map((s) => s.ruleId))];
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
        schema.policyRulePlanValidationOpa,
      ] as const;

      const unions = ruleTables.map(
        (t) =>
          sql`SELECT ${t.id} AS rule_id, ${t.policyId} AS policy_id FROM ${t} WHERE ${inArray(t.id, ruleIds)}`,
      );
      const ruleRows = await ctx.db.execute<{
        rule_id: string;
        policy_id: string;
      }>(sql.join(unions, sql` UNION ALL `));

      const ruleToPolicyId = new Map(
        ruleRows.rows.map((r) => [r.rule_id, r.policy_id]),
      );
      const policyIds = [...new Set(ruleRows.rows.map((r) => r.policy_id))];

      const policyNameById = new Map<string, string>();
      if (policyIds.length > 0) {
        const policies = await ctx.db
          .select({ id: schema.policy.id, name: schema.policy.name })
          .from(schema.policy)
          .where(inArray(schema.policy.id, policyIds));
        for (const p of policies) policyNameById.set(p.id, p.name);
      }

      return skips.map((skip) => {
        const policyId = ruleToPolicyId.get(skip.ruleId);
        const policyName =
          policyId != null ? (policyNameById.get(policyId) ?? null) : null;
        return { ...skip, policyName };
      });
    }),

  createForTarget: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        environmentId: z.string(),
        resourceId: z.string(),
        versionId: z.string(),
        ruleId: z.string(),
        expiresAt: z.date().optional(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, environmentId, resourceId, versionId, ruleId } =
        input;

      const version = await ctx.db
        .select({ deploymentId: schema.deploymentVersion.deploymentId })
        .from(schema.deploymentVersion)
        .where(eq(schema.deploymentVersion.id, versionId))
        .then(takeFirstOrNull);

      if (version == null)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });

      const skip = await ctx.db
        .insert(schema.policySkip)
        .values({
          createdBy: ctx.session.user.id,
          environmentId,
          resourceId,
          versionId,
          ruleId,
          expiresAt: input.expiresAt,
          reason: input.reason ?? "Skipped by user",
        })
        .returning()
        .then(takeFirst);

      await enqueueDesiredRelease(ctx.db, {
        workspaceId,
        deploymentId: version.deploymentId,
        environmentId,
        resourceId,
      });

      return skip;
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        skipId: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, skipId } = input;

      const deleted = await ctx.db
        .delete(schema.policySkip)
        .where(eq(schema.policySkip.id, skipId))
        .returning()
        .then(takeFirstOrNull);

      if (deleted == null)
        throw new TRPCError({ code: "NOT_FOUND", message: "Skip not found" });

      if (deleted.environmentId == null) return deleted;

      if (deleted.resourceId != null) {
        const version = await ctx.db
          .select({ deploymentId: schema.deploymentVersion.deploymentId })
          .from(schema.deploymentVersion)
          .where(eq(schema.deploymentVersion.id, deleted.versionId))
          .then(takeFirstOrNull);

        if (version != null)
          await enqueueDesiredRelease(ctx.db, {
            workspaceId,
            deploymentId: version.deploymentId,
            environmentId: deleted.environmentId,
            resourceId: deleted.resourceId,
          });

        return deleted;
      }

      await enqueueReleaseTargetsForEnvironment(
        ctx.db,
        workspaceId,
        deleted.environmentId,
      );

      return deleted;
    }),
});
