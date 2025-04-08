import _ from "lodash";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import {
  createPolicy,
  createPolicyRuleDenyWindow,
  createPolicyRuleDeploymentVersionSelector,
  createPolicyTarget,
  policy,
  policyRuleDenyWindow,
  policyRuleDeploymentVersionSelector,
  policyTarget,
  updatePolicy,
  updatePolicyRuleDenyWindow,
  updatePolicyRuleDeploymentVersionSelector,
  updatePolicyTarget,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const policyRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.query.policy.findMany({
        where: eq(policy.workspaceId, input),
        with: {
          targets: true,
          denyWindows: true,
          deploymentVersionSelector: true,
        },
      }),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.PolicyGet).on({ type: "policy", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db.query.policy.findFirst({
        where: eq(policy.id, input),
        with: {
          targets: true,
          denyWindows: true,
          deploymentVersionSelector: true,
        },
      }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createPolicy)
    .mutation(async ({ ctx, input }) =>
      ctx.db.insert(policy).values(input).returning().then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updatePolicy }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db
        .update(policy)
        .set(input.data)
        .where(eq(policy.id, input.id))
        .returning()
        .then(takeFirst);
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(policy)
        .where(eq(policy.id, input))
        .returning()
        .then(takeFirst),
    ),

  // Target endpoints
  createTarget: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "policy", id: input.policyId }),
    })
    .input(createPolicyTarget)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(policyTarget).values(input).returning().then(takeFirst),
    ),

  updateTarget: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const target = await ctx.db
          .select()
          .from(policyTarget)
          .where(eq(policyTarget.id, input.id))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: target.policyId });
      },
    })
    .input(z.object({ id: z.string().uuid(), data: updatePolicyTarget }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(policyTarget)
        .set(input.data)
        .where(eq(policyTarget.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  deleteTarget: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const target = await ctx.db
          .select()
          .from(policyTarget)
          .where(eq(policyTarget.id, input))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: target.policyId });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(policyTarget)
        .where(eq(policyTarget.id, input))
        .returning()
        .then(takeFirst),
    ),

  // Deny Window endpoints
  createDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "policy", id: input.policyId }),
    })
    .input(createPolicyRuleDenyWindow)
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(policyRuleDenyWindow)
        .values(input)
        .returning()
        .then(takeFirst);
    }),

  updateDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const denyWindow = await ctx.db
          .select()
          .from(policyRuleDenyWindow)
          .where(eq(policyRuleDenyWindow.id, input.id))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: denyWindow.policyId });
      },
    })
    .input(
      z.object({ id: z.string().uuid(), data: updatePolicyRuleDenyWindow }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(policyRuleDenyWindow)
        .set(input.data)
        .where(eq(policyRuleDenyWindow.id, input.id))
        .returning()
        .then(takeFirst);
    }),

  deleteDenyWindow: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const denyWindow = await ctx.db
          .select()
          .from(policyRuleDenyWindow)
          .where(eq(policyRuleDenyWindow.id, input))
          .then(takeFirst);

        return canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: denyWindow.policyId });
      },
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(policyRuleDenyWindow)
        .where(eq(policyRuleDenyWindow.id, input))
        .returning()
        .then(takeFirst),
    ),

  // Deployment Version Selector endpoints
  createDeploymentVersionSelector: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "policy", id: input.policyId }),
    })
    .input(createPolicyRuleDeploymentVersionSelector)
    .mutation(({ ctx, input }) => {
      return ctx.db
        .insert(policyRuleDeploymentVersionSelector)
        .values(input)
        .returning()
        .then(takeFirst);
    }),

  updateDeploymentVersionSelector: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) => {
        return canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "policy", id: input.policyId });
      },
    })
    .input(
      z.object({
        policyId: z.string().uuid(),
        data: updatePolicyRuleDeploymentVersionSelector.omit({
          policyId: true,
        }),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db
        .update(policyRuleDeploymentVersionSelector)
        .set(input.data)
        .where(eq(policyRuleDeploymentVersionSelector.policyId, input.policyId))
        .returning()
        .then(takeFirst);
    }),

  deleteDeploymentVersionSelector: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, input }) => {
        return canUser
          .perform(Permission.PolicyDelete)
          .on({ type: "policy", id: input.policyId });
      },
    })
    .input(z.object({ policyId: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(policyRuleDeploymentVersionSelector)
        .where(eq(policyRuleDeploymentVersionSelector.policyId, input.policyId))
        .returning()
        .then(takeFirst),
    ),
});
