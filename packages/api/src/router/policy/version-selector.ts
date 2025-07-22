import { z } from "zod";

import {
  buildConflictUpdateColumns,
  eq,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { deploymentVersionCondition } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

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
    .mutation(({ ctx, input: { name, policyId, versionSelector } }) =>
      ctx.db
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
        .returning(),
    ),

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
    .mutation(({ ctx, input: { name, policyId, versionSelector } }) =>
      ctx.db
        .update(schema.policyRuleDeploymentVersionSelector)
        .set({
          deploymentVersionSelector: versionSelector,
          name: name ?? "",
        })
        .where(
          eq(schema.policyRuleDeploymentVersionSelector.policyId, policyId),
        )
        .returning()
        .then(takeFirst),
    ),
});
