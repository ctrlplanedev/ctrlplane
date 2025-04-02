import { addMilliseconds } from "date-fns";
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
import { DeploymentDenyRule } from "@ctrlplane/rule-engine";
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

  denyWindow: createTRPCRouter({
    list: createTRPCRouter({
      byWorkspaceId: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.PolicyGet)
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .input(
          z.object({
            workspaceId: z.string().uuid(),
            start: z.date(),
            end: z.date(),
            timeZone: z.string(),
          }),
        )
        .query(async ({ ctx, input }) => {
          const denyWindows = await ctx.db
            .select()
            .from(policyRuleDenyWindow)
            .innerJoin(policy, eq(policyRuleDenyWindow.policyId, policy.id))
            .where(eq(policy.workspaceId, input.workspaceId))
            .then((rows) => rows.map((row) => row.policy_rule_deny_window));

          return denyWindows.flatMap((denyWindow) => {
            const rrule = { ...denyWindow.rrule, tzid: denyWindow.timeZone };
            const dtstart =
              denyWindow.rrule.dtstart == null
                ? null
                : new Date(denyWindow.rrule.dtstart);
            const rule = new DeploymentDenyRule({
              ...rrule,
              dtend: denyWindow.dtend,
              dtstart,
            });
            const windows = rule.getWindowsInRange(input.start, input.end);
            const events = windows.map((window, idx) => ({
              id: `${denyWindow.id}-${idx}`,
              start: window.start,
              end: window.end,
              title: denyWindow.name === "" ? "Deny Window" : denyWindow.name,
            }));
            return { ...denyWindow, events };
          });
        }),
    }),

    create: protectedProcedure
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

    resize: protectedProcedure
      .meta({
        authorizationCheck: async ({ ctx, canUser, input }) => {
          const denyWindow = await ctx.db
            .select()
            .from(policyRuleDenyWindow)
            .where(eq(policyRuleDenyWindow.id, input.windowId))
            .then(takeFirst);

          return canUser
            .perform(Permission.PolicyUpdate)
            .on({ type: "policy", id: denyWindow.policyId });
        },
      })
      .input(
        z.object({
          windowId: z.string().uuid(),
          dtstartOffset: z.number(),
          dtendOffset: z.number(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const denyWindow = await ctx.db
          .select()
          .from(policyRuleDenyWindow)
          .where(eq(policyRuleDenyWindow.id, input.windowId))
          .then(takeFirst);

        const currStart = denyWindow.rrule.dtstart;
        const currEnd = denyWindow.dtend;

        const newStart =
          currStart != null
            ? addMilliseconds(currStart, input.dtstartOffset)
            : null;

        const newRrule = { ...denyWindow.rrule, dtstart: newStart };
        const newdtend =
          currEnd != null ? addMilliseconds(currEnd, input.dtendOffset) : null;

        return ctx.db
          .update(policyRuleDenyWindow)
          .set({
            rrule: newRrule,
            dtend: newdtend,
          })
          .where(eq(policyRuleDenyWindow.id, input.windowId))
          .returning()
          .then(takeFirst);
      }),
    update: protectedProcedure
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

    delete: protectedProcedure
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
  }),

  // Deny Window endpoints
});
