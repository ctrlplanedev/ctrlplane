import { z } from "zod";

import { and, count, eq, like, or, takeFirst } from "@ctrlplane/db";
import { createSystem, system, updateSystem } from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { createEnv } from "./environment";

export const systemRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      access: ({ ctx, input }) =>
        ctx.accessQuery().workspace.id(input.workspaceId),
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
    .input(z.string())
    .query(({ ctx: { db }, input }) =>
      db.query.system.findFirst({ where: eq(system.slug, input) }),
    ),

  byId: protectedProcedure.input(z.string()).query(({ ctx: { db }, input }) => {
    db.query.system.findMany({ where: eq(system.id, input) });
  }),

  create: protectedProcedure

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
    .input(z.object({ id: z.string(), data: updateSystem }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(system)
        .set(input.data)
        .where(eq(system.id, input.id))
        .returning()
        .then(takeFirst),
    ),
});
