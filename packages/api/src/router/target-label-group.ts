import { z } from "zod";

import { asc, eq, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { target, targetLabelGroup, workspace } from "@ctrlplane/db/schema";
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
    .query(({ ctx, input }) =>
      ctx.db
        .select({
          targets: sql<number>`count(${target.id})`.mapWith(Number),
          targetLabelGroup,
        })
        .from(targetLabelGroup)
        .innerJoin(workspace, eq(targetLabelGroup.workspaceId, workspace.id))
        .leftJoin(target, sql`${target.labels} ?& ${targetLabelGroup.keys}`)
        .where(eq(workspace.id, input))
        .groupBy(workspace.id, targetLabelGroup.id)
        .orderBy(asc(targetLabelGroup.name)),
    ),

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
          targets: sql<number>`count(${target.id})`.mapWith(Number),
          ...Object.fromEntries(
            group.keys.map((k) => [
              k,
              sql.raw(`"target"."labels" ->> '${k}'`).as(k),
            ]),
          ),
        })
        .from(target)
        .where(
          sql.raw(
            `"target"."labels" ?& array[${group.keys.map((k) => `'${k}'`).join(",")}]`,
          ),
        )
        .groupBy(
          ...group.keys.map((k) => sql.raw(`"target"."labels" ->> '${k}'`)),
        );

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
