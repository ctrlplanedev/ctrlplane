import { z } from "zod";

import {
  and,
  asc,
  eq,
  inArray,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  target,
  targetLabel,
  targetLabelGroup,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const targetLabelGroupRouter = createTRPCRouter({
  groups: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) => {
      return ctx.db
        .select({
          targets: sql<number>`count(distinct ${target.id})`.mapWith(Number),
          targetLabelGroup,
        })
        .from(targetLabelGroup)
        .innerJoin(workspace, eq(targetLabelGroup.workspaceId, workspace.id))
        .leftJoin(target, eq(target.workspaceId, workspace.id))
        .leftJoin(targetLabel, eq(targetLabel.targetId, target.id))
        .where(
          and(
            eq(workspace.id, input),
            sql`"target_label"."label" = ANY (${targetLabelGroup.keys})`,
          ),
        )
        .groupBy(targetLabelGroup.id)
        .orderBy(asc(targetLabelGroup.name));
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetGet)
          .on({ type: "targetLabelGroup", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const group = await ctx.db
        .select()
        .from(targetLabelGroup)
        .where(eq(targetLabelGroup.id, input))
        .then(takeFirstOrNull);

      if (group == null) throw new Error("Group not found");

      const groups = await ctx.db
        .select({
          targets: sql<number>`count(distinct ${target.id})`.mapWith(Number),
          ...Object.fromEntries(
            group.keys.map((k) => [k, sql.raw(`"target_label"."value"`).as(k)]),
          ),
        })
        .from(target)
        .innerJoin(targetLabel, eq(targetLabel.targetId, target.id))
        .where(
          and(
            inArray(targetLabel.label, group.keys),
            eq(target.workspaceId, group.workspaceId),
          ),
        )
        .groupBy(targetLabel.value);

      return {
        ...group,
        groups: groups as Array<{ targets: number } & Record<string, string>>,
      };
    }),

  upsert: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        data: z.object({
          id: z.string().optional(),
          name: z.string(),
          keys: z.array(z.string()),
          description: z.string(),
        }),
      }),
    )
    .mutation(({ ctx, input }) => {
      ctx.db
        .insert(targetLabelGroup)
        .values({
          ...input.data,
          workspaceId: input.workspaceId,
        })
        .onConflictDoUpdate({
          target: targetLabelGroup.id,
          set: {
            ...input.data,
          },
        })
        .returning()
        .then(takeFirst);
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetDelete)
          .on({ type: "targetLabelGroup", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.delete(targetLabelGroup).where(eq(targetLabelGroup.id, input)),
    ),
});
