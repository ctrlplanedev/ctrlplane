import { z } from "zod";

import { and, count, eq, like, or, takeFirst } from "@ctrlplane/db";
import {
  createSystem,
  system,
  updateSystem,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { createEnv } from "./environment";

export const systemRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        filters: z
          .array(
            z.object({
              key: z.enum(["name", "slug"]),
              value: z.any(),
            }),
          )
          .optional(),
        limit: z.number().default(500),
        offset: z.number().default(0),
      }),
    )
    .query(({ ctx, input }) => {
      const workspaceIdCheck = eq(system.workspaceId, input.workspaceId);
      const nameFilters = (input.filters ?? [])
        .filter((f) => f.key === "name")
        .map((f) => like(system.name, `%${f.value}%`));

      const slugFilters = (input.filters ?? [])
        .filter((f) => f.key === "slug")
        .map((f) => like(system.slug, `%${f.value}%`));

      const checks = [workspaceIdCheck, or(...nameFilters), or(...slugFilters)];

      const items = ctx.db
        .select()
        .from(system)
        .where(and(...checks))
        .limit(input.limit)
        .offset(input.offset);

      const total = ctx.db
        .select({ count: count().as("total") })
        .from(system)
        .where(and(...checks))
        .then(takeFirst)
        .then((total) => total.count);

      return Promise.all([items, total]).then(([items, total]) => ({
        items,
        total,
      }));
    }),

  bySlug: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const sys = await ctx.db
          .select()
          .from(system)
          .innerJoin(workspace, eq(system.workspaceId, workspace.id))
          .where(
            and(
              eq(system.slug, input.systemSlug),
              eq(workspace.slug, input.workspaceSlug),
            ),
          )
          .then(takeFirst);
        return canUser
          .perform(Permission.SystemGet)
          .on({ type: "system", id: sys.system.id });
      },
    })
    .input(z.object({ workspaceSlug: z.string(), systemSlug: z.string() }))
    .query(({ ctx: { db }, input }) =>
      db
        .select()
        .from(system)
        .innerJoin(workspace, eq(system.workspaceId, workspace.id))
        .where(
          and(
            eq(system.slug, input.systemSlug),
            eq(workspace.slug, input.workspaceSlug),
          ),
        )
        .then(takeFirst)
        .then((m) => ({ ...m.system, workspace: m.workspace })),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createSystem)
    .mutation(({ ctx: { db }, input }) =>
      db.transaction(async (db) => {
        const sys = await db
          .insert(system)
          .values(input)
          .returning()
          .then(takeFirst);

        await Promise.all([
          createEnv(db, { systemId: sys.id, name: "Production" }),
          createEnv(db, { systemId: sys.id, name: "QA" }),
          createEnv(db, { systemId: sys.id, name: "Staging" }),
        ]);
        return sys;
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "system", id: input.id }),
    })
    .input(z.object({ id: z.string(), data: updateSystem }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(system)
        .set(input.data)
        .where(eq(system.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemDelete)
          .on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(system)
        .where(eq(system.id, input))
        .returning()
        .then(takeFirst),
    ),
});
