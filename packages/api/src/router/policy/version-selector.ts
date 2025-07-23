import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import {
  buildConflictUpdateColumns,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";
import { deploymentVersionCondition } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const getPolicyTargets = async (db: Tx, policyId: string) =>
  db
    .select()
    .from(schema.policyTarget)
    .where(eq(schema.policyTarget.policyId, policyId));

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

      const policyTargets = await getPolicyTargets(ctx.db, policyId);
      for (const policyTarget of policyTargets)
        dispatchQueueJob()
          .toCompute()
          .policyTarget(policyTarget)
          .releaseTargetSelector();

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

      const policyTargets = await getPolicyTargets(ctx.db, policyId);
      for (const policyTarget of policyTargets)
        dispatchQueueJob()
          .toCompute()
          .policyTarget(policyTarget)
          .releaseTargetSelector();

      return vs;
    }),
});
