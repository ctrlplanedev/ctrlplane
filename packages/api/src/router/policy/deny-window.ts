import type * as rrule from "rrule";
import { addMilliseconds } from "date-fns";
import { z } from "zod";

import { eq, takeFirst } from "@ctrlplane/db";
import {
  createPolicyRuleDenyWindow,
  policy,
  policyRuleDenyWindow,
  updatePolicyRuleDenyWindow,
} from "@ctrlplane/db/schema";
import { DeploymentDenyRule } from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
const weekdayMap: Record<Weekday, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

export const denyWindowRouter = createTRPCRouter({
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
          .where(eq(policy.workspaceId, input.workspaceId));

        return denyWindows.flatMap((dw) => {
          const { policy_rule_deny_window: denyWindow, policy } = dw;
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
            id: `${denyWindow.id}|${idx}`,
            start: window.start,
            end: window.end,
            title: denyWindow.name === "" ? "Deny Window" : denyWindow.name,
          }));
          return { ...denyWindow, events, policy };
        });
      }),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "workspace", id: input.worspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        data: createPolicyRuleDenyWindow,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { workspaceId, data } = input;
      const policyId: string =
        data.policyId ??
        (await ctx.db
          .insert(policy)
          .values({ workspaceId, name: data.name })
          .returning()
          .then(takeFirst)
          .then((policy) => policy.id));

      return ctx.db
        .insert(policyRuleDenyWindow)
        .values({ ...data, policyId })
        .returning()
        .then(takeFirst);
    }),

  createInCalendar: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.PolicyCreate)
          .on({ type: "policy", id: input.policyId }),
    })
    .input(
      z.object({
        policyId: z.string().uuid(),
        start: z.date(),
        end: z.date(),
        timeZone: z.string(),
      }),
    )
    .mutation(({ ctx, input }) => {
      console.log(input);

      return;
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
        .set({ rrule: newRrule, dtend: newdtend })
        .where(eq(policyRuleDenyWindow.id, input.windowId))
        .returning()
        .then(takeFirst);
    }),

  drag: protectedProcedure
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
        offset: z.number(),
        day: z.number().transform((val) => weekdayMap[val as Weekday]),
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
        currStart != null ? addMilliseconds(currStart, input.offset) : null;

      const newRrule = {
        ...denyWindow.rrule,
        dtstart: newStart,
        byweekday: [input.day as rrule.ByWeekday],
      };
      const newdtend =
        currEnd != null ? addMilliseconds(currEnd, input.offset) : null;

      return ctx.db
        .update(policyRuleDenyWindow)
        .set({ rrule: newRrule, dtend: newdtend })
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
});
