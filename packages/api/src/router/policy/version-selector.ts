import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import {
  buildConflictUpdateColumns,
  eq,
  rulesAndTargets,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { getApplicablePolicies } from "@ctrlplane/rule-engine/db";
import { Permission } from "@ctrlplane/validators/auth";
import { deploymentVersionCondition } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const dispatchPolicyUpdated = (db: Tx, policyId: string) =>
  db.query.policy
    .findFirst({
      where: eq(schema.policy.id, policyId),
      with: rulesAndTargets,
    })
    .then((fullPolicy) => {
      if (fullPolicy == null) return;
      eventDispatcher.dispatchPolicyUpdated(fullPolicy, fullPolicy);
    });

export const policyVersionSelectorRouter = createTRPCRouter({
  byPolicyId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.PolicyGet).on({
          type: "policy",
          id: input,
        }),
    })
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(schema.policyRuleDeploymentVersionSelector)
        .where(eq(schema.policyRuleDeploymentVersionSelector.policyId, input))
        .then(takeFirstOrNull),
    ),

  byReleaseTargetId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ReleaseTargetGet).on({
          type: "releaseTarget",
          id: input,
        }),
    })
    .query(({ ctx, input }) =>
      getApplicablePolicies(ctx.db, input).then((policies) =>
        policies
          .filter(
            (p) =>
              p.deploymentVersionSelector?.deploymentVersionSelector != null,
          )
          .map((p) => ({
            id: p.id,
            name: p.name,
            deploymentVersionSelector:
              p.deploymentVersionSelector!.deploymentVersionSelector,
            priority: p.priority,
          })),
      ),
    ),

  create: protectedProcedure
    .input(
      z.object({
        policyId: z.string().uuid(),
        versionSelector: deploymentVersionCondition,
        name: z.string().optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.PolicyUpdate).on({
          type: "policy",
          id: input.policyId,
        }),
    })
    .mutation(async ({ ctx, input: { name, policyId, versionSelector } }) => {
      const vs = await ctx.db
        .insert(schema.policyRuleDeploymentVersionSelector)
        .values({
          name: name ?? "",
          policyId,
          deploymentVersionSelector: versionSelector,
        })
        .onConflictDoUpdate({
          target: [schema.policyRuleDeploymentVersionSelector.policyId],
          set: buildConflictUpdateColumns(
            schema.policyRuleDeploymentVersionSelector,
            ["deploymentVersionSelector", "name"],
          ),
        })
        .returning()
        .then(takeFirst);

      dispatchPolicyUpdated(ctx.db, policyId);

      return vs;
    }),

  update: protectedProcedure
    .input(
      z.object({
        policyId: z.string().uuid(),
        versionSelector: deploymentVersionCondition,
        name: z.string().optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.PolicyUpdate).on({
          type: "policy",
          id: input.policyId,
        }),
    })
    .mutation(async ({ ctx, input: { name, policyId, versionSelector } }) => {
      const vs = await ctx.db
        .update(schema.policyRuleDeploymentVersionSelector)
        .set({
          deploymentVersionSelector: versionSelector,
          name: name ?? "",
        })
        .where(
          eq(schema.policyRuleDeploymentVersionSelector.policyId, policyId),
        )
        .returning()
        .then(takeFirst);

      dispatchPolicyUpdated(ctx.db, policyId);

      return vs;
    }),
});
