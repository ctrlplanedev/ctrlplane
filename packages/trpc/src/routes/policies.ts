import { TRPCError } from "@trpc/server";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

import { and, eq } from "@ctrlplane/db";
import { enqueueAllReleaseTargetsDesiredVersion } from "@ctrlplane/db/reconcilers";
import * as schema from "@ctrlplane/db/schema";
import { getClientFor } from "@ctrlplane/workspace-engine-sdk";

import { protectedProcedure, router } from "../trpc.js";

const EvaluationScope = z.object({
  environmentId: z.uuid(),
  versionId: z.uuid(),
});

export const policiesRouter = router({
  evaluate: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        scope: EvaluationScope,
      }),
    )
    .query(async ({ input }) => {
      const { workspaceId, scope } = input;
      const result = await getClientFor(workspaceId).POST(
        "/v1/workspaces/{workspaceId}/policies/evaluate",
        {
          params: { path: { workspaceId } },
          body: scope,
        },
      );
      return result.data?.decision;
    }),

  list: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const { workspaceId } = input;
      return ctx.db.query.policy.findMany({
        where: eq(schema.policy.workspaceId, workspaceId),
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
    }),

  delete: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        policyId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, policyId } = input;

      const [deleted] = await ctx.db
        .delete(schema.policy)
        .where(
          and(
            eq(schema.policy.id, policyId),
            eq(schema.policy.workspaceId, workspaceId),
          ),
        )
        .returning();

      if (!deleted)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });

      await enqueueAllReleaseTargetsDesiredVersion(ctx.db, workspaceId);

      return deleted;
    }),

  upsert: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        policyId: z.string().uuid(),
        body: z.object({
          name: z.string(),
          description: z.string().optional(),
          enabled: z.boolean(),
          priority: z.number(),
          metadata: z.record(z.string(), z.string()),
          rules: z.array(z.record(z.string(), z.any())),
          selector: z.string(),
        }),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { workspaceId, policyId, body } = input;

      const existing = await ctx.db
        .select({ createdAt: schema.policy.createdAt })
        .from(schema.policy)
        .where(eq(schema.policy.id, policyId))
        .limit(1);

      const now = new Date();
      const createdAt = existing[0]?.createdAt ?? now;

      await ctx.db.transaction(async (tx) => {
        await tx
          .insert(schema.policy)
          .values({
            id: policyId,
            workspaceId,
            name: body.name,
            description: body.description,
            priority: body.priority,
            enabled: body.enabled,
            metadata: body.metadata,
            selector: body.selector,
            createdAt,
          })
          .onConflictDoUpdate({
            target: schema.policy.id,
            set: {
              name: body.name,
              description: body.description,
              priority: body.priority,
              enabled: body.enabled,
              metadata: body.metadata,
              selector: body.selector,
            },
          });

        // Delete existing rules before re-inserting
        await tx
          .delete(schema.policyRuleAnyApproval)
          .where(eq(schema.policyRuleAnyApproval.policyId, policyId));
        await tx
          .delete(schema.policyRuleDeploymentDependency)
          .where(eq(schema.policyRuleDeploymentDependency.policyId, policyId));
        await tx
          .delete(schema.policyRuleDeploymentWindow)
          .where(eq(schema.policyRuleDeploymentWindow.policyId, policyId));
        await tx
          .delete(schema.policyRuleEnvironmentProgression)
          .where(
            eq(schema.policyRuleEnvironmentProgression.policyId, policyId),
          );
        await tx
          .delete(schema.policyRuleGradualRollout)
          .where(eq(schema.policyRuleGradualRollout.policyId, policyId));
        await tx
          .delete(schema.policyRuleRetry)
          .where(eq(schema.policyRuleRetry.policyId, policyId));
        await tx
          .delete(schema.policyRuleRollback)
          .where(eq(schema.policyRuleRollback.policyId, policyId));
        await tx
          .delete(schema.policyRuleVerification)
          .where(eq(schema.policyRuleVerification.policyId, policyId));
        await tx
          .delete(schema.policyRuleVersionCooldown)
          .where(eq(schema.policyRuleVersionCooldown.policyId, policyId));
        await tx
          .delete(schema.policyRuleVersionSelector)
          .where(eq(schema.policyRuleVersionSelector.policyId, policyId));

        // Insert new rules
        for (const rule of body.rules) {
          const ruleId: string =
            typeof rule.id === "string" ? rule.id : uuidv4();

          if (rule.anyApproval != null)
            await tx.insert(schema.policyRuleAnyApproval).values({
              id: ruleId,
              policyId,
              minApprovals: (rule.anyApproval as { minApprovals: number })
                .minApprovals,
            });

          if (rule.deploymentDependency != null)
            await tx.insert(schema.policyRuleDeploymentDependency).values({
              id: ruleId,
              policyId,
              dependsOn: (rule.deploymentDependency as { dependsOn: string })
                .dependsOn,
            });

          if (rule.deploymentWindow != null) {
            const dw = rule.deploymentWindow as {
              allowWindow: boolean;
              durationMinutes: number;
              rrule: string;
              timezone?: string;
            };
            await tx.insert(schema.policyRuleDeploymentWindow).values({
              id: ruleId,
              policyId,
              allowWindow: dw.allowWindow,
              durationMinutes: dw.durationMinutes,
              rrule: dw.rrule,
              timezone: dw.timezone,
            });
          }

          if (rule.environmentProgression != null) {
            const ep = rule.environmentProgression as {
              dependsOnEnvironmentSelector: unknown;
              maximumAgeHours?: number;
              minimumSockTimeMinutes?: number;
              minimumSuccessPercentage?: number;
              successStatuses?: string[];
            };
            await tx.insert(schema.policyRuleEnvironmentProgression).values({
              id: ruleId,
              policyId,
              dependsOnEnvironmentSelector: JSON.stringify(
                ep.dependsOnEnvironmentSelector,
              ),
              maximumAgeHours: ep.maximumAgeHours,
              minimumSoakTimeMinutes: ep.minimumSockTimeMinutes,
              minimumSuccessPercentage: ep.minimumSuccessPercentage,
              successStatuses: ep.successStatuses,
            });
          }

          if (rule.gradualRollout != null) {
            const gr = rule.gradualRollout as {
              rolloutType: string;
              timeScaleInterval: number;
            };
            await tx.insert(schema.policyRuleGradualRollout).values({
              id: ruleId,
              policyId,
              rolloutType: gr.rolloutType,
              timeScaleInterval: gr.timeScaleInterval,
            });
          }

          if (rule.retry != null) {
            const rt = rule.retry as {
              maxRetries: number;
              backoffSeconds?: number;
              backoffStrategy?: string;
              maxBackoffSeconds?: number;
              retryOnStatuses?: string[];
            };
            await tx.insert(schema.policyRuleRetry).values({
              id: ruleId,
              policyId,
              maxRetries: rt.maxRetries,
              backoffSeconds: rt.backoffSeconds,
              backoffStrategy: rt.backoffStrategy,
              maxBackoffSeconds: rt.maxBackoffSeconds,
              retryOnStatuses: rt.retryOnStatuses,
            });
          }

          if (rule.verification != null) {
            const vr = rule.verification as {
              metrics: unknown;
              triggerOn?: string;
            };
            await tx.insert(schema.policyRuleVerification).values({
              id: ruleId,
              policyId,
              metrics: vr.metrics,
              triggerOn: vr.triggerOn,
            });
          }

          if (rule.versionCooldown != null)
            await tx.insert(schema.policyRuleVersionCooldown).values({
              id: ruleId,
              policyId,
              intervalSeconds: (
                rule.versionCooldown as { intervalSeconds: number }
              ).intervalSeconds,
            });

          if (rule.versionSelector != null) {
            const vs = rule.versionSelector as {
              selector: unknown;
              description?: string;
            };
            await tx.insert(schema.policyRuleVersionSelector).values({
              id: ruleId,
              policyId,
              description: vs.description,
              selector: JSON.stringify(vs.selector),
            });
          }
        }
      });

      await enqueueAllReleaseTargetsDesiredVersion(ctx.db, workspaceId);

      return { id: policyId };
    }),

  releaseTargets: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        policyId: z.string(),
      }),
    )
    .query(() => {
      // TODO: Implement

      return [];
    }),
});
