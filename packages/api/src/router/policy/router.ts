import _ from "lodash";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import {
  createPolicy,
  createPolicyTarget,
  policy,
  policyTarget,
  updatePolicy,
  updatePolicyTarget,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { denyWindowRouter } from "./deny-window";

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
        with: { targets: true, denyWindows: true },
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
        with: { targets: true, denyWindows: true },
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

  denyWindow: denyWindowRouter,
});
