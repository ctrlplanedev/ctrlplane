import _ from "lodash";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import {
  createPolicy,
  createPolicyRuleDenyWindow,
  createPolicyTarget,
  policy,
  policyRuleDenyWindow,
  policyTarget,
  updatePolicy,
  updatePolicyRuleDenyWindow,
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
      ctx.db.select().from(policy).where(eq(policy.workspaceId, input)),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.PolicyGet).on({ type: "policy", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const policyData = await ctx.db
        .select()
        .from(policy)
        .where(eq(policy.id, input))
        .then(takeFirst);

      const targets = await ctx.db
        .select()
        .from(policyTarget)
        .where(eq(policyTarget.policyId, input));

      const denyWindows = await ctx.db
        .select()
        .from(policyRuleDenyWindow)
        .where(eq(policyRuleDenyWindow.policyId, input));

      return {
        ...policyData,
        targets,
        denyWindows,
      };
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createPolicy)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (db) =>
        db.insert(policy).values(input).returning().then(takeFirst),
      ),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyUpdate)
          .on({ type: "workspace", id: input.id }),
      // Note: workspace ID should be determined by looking up the policy
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
          .on({ type: "workspace", id: input }),
      // Note: workspace ID should be determined by looking up the policy
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (db) => {
        // Delete all related targets and deny windows (cascade delete should handle this)
        return db
          .delete(policy)
          .where(eq(policy.id, input))
          .returning()
          .then(takeFirst);
      }),
    ),

  // Target endpoints
  createTarget: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.policyId }),
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
          .on({ type: "workspace", id: target.policyId });
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
          .on({ type: "workspace", id: target.policyId });
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
          .on({ type: "workspace", id: input.policyId }),
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
          .on({ type: "workspace", id: denyWindow.policyId });
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
          .on({ type: "workspace", id: denyWindow.policyId });
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
});
