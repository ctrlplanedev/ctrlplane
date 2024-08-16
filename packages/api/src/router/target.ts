import type { SQL, Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  like,
  or,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  cerateTargetProviderGoogle,
  createTarget,
  createTargetProvider,
  target,
  targetLabelGroup,
  targetProvider,
  targetProviderGoogle,
  updateTarget,
  workspace,
} from "@ctrlplane/db/schema";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const labelGroupRouter = createTRPCRouter({
  groups: protectedProcedure
    .meta({
      access: ({ ctx, input }) => ctx.accessQuery().workspace.id(input),
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
        .innerJoin(target, sql`${target.labels} ?& ${targetLabelGroup.keys}`)
        .where(eq(workspace.id, input))
        .groupBy(workspace.id, targetLabelGroup.id)
        .orderBy(asc(targetLabelGroup.name)),
    ),
  byId: protectedProcedure
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
      access: ({ ctx, input }) =>
        ctx.accessQuery().workspace.id(input.workspaceId),
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
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.delete(targetLabelGroup).where(eq(targetLabelGroup.id, input)),
    ),
});

const targetProviderRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(targetProvider)
        .where(eq(targetProvider.workspaceId, input)),
    ),

  managed: createTRPCRouter({
    google: protectedProcedure
      .input(
        createTargetProvider.and(
          z.object({
            config: cerateTargetProviderGoogle.omit({ targetProviderId: true }),
          }),
        ),
      )
      .mutation(({ ctx, input }) =>
        ctx.db.transaction(async (db) => {
          const tg = await db
            .insert(targetProvider)
            .values(input)
            .returning()
            .then(takeFirst);
          const tgConfig = await db
            .insert(targetProviderGoogle)
            .values({ ...input.config, targetProviderId: tg.id })
            .returning()
            .then(takeFirst);
          return { ...tg, config: tgConfig };
        }),
      ),
  }),
});

const targetQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select()
    .from(target)
    .innerJoin(targetProvider, eq(target.providerId, targetProvider.id))
    .innerJoin(workspace, eq(targetProvider.workspaceId, workspace.id))
    .where(and(...checks))
    .orderBy(desc(target.kind));

export const targetRouter = createTRPCRouter({
  labelGroup: labelGroupRouter,
  provider: targetProviderRouter,

  byId: protectedProcedure.input(z.string()).query(({ ctx, input }) =>
    ctx.db
      .select()
      .from(target)
      .innerJoin(targetProvider, eq(target.providerId, targetProvider.id))
      .where(eq(target.id, input))
      .then(takeFirstOrNull)
      .then((a) =>
        a == null ? null : { ...a.target, provider: a.target_provider },
      ),
  ),

  byWorkspaceId: createTRPCRouter({
    list: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid().optional(),
          filters: z
            .array(
              z.object({
                key: z.enum(["name", "kind", "labels"]),
                value: z.any(),
              }),
            )
            .optional(),
          limit: z.number().default(500),
          offset: z.number().default(0),
        }),
      )
      .query(({ ctx, input }) => {
        const workspaceIdCheck =
          input.workspaceId != null
            ? eq(workspace.id, input.workspaceId)
            : undefined;

        const nameFilters = (input.filters ?? [])
          .filter((f) => f.key === "name")
          .map((f) => like(target.name, `%${f.value}%`));
        const kindFilters = (input.filters ?? [])
          .filter((f) => f.key === "kind")
          .map((f) => eq(target.kind, f.value));
        const labelFilters = (input.filters ?? [])
          .filter((f) => f.key === "labels")
          .map((f) => arrayContains(target.labels, f.value));

        const checks = [
          workspaceIdCheck,
          or(...nameFilters),
          or(...kindFilters),
          or(...labelFilters),
        ].filter(isPresent);

        const items = targetQuery(ctx.db, checks)
          .limit(input.limit)
          .offset(input.offset)
          .then((t) =>
            t.map((a) => ({ ...a.target, provider: a.target_provider })),
          );
        const total = targetQuery(ctx.db, checks).then((t) => t.length);

        return Promise.all([items, total]).then(([items, total]) => ({
          items,
          total,
        }));
      }),

    kinds: protectedProcedure.input(z.string().uuid()).query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ kind: target.kind })
        .from(target)
        .innerJoin(targetProvider, eq(target.providerId, targetProvider.id))
        .innerJoin(workspace, eq(targetProvider.workspaceId, workspace.id))
        .where(eq(workspace.id, input))
        .then((r) => r.map((row) => row.kind)),
    ),

    filtered: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          filters: z.array(
            z.object({ key: z.enum(["name", "kind"]), value: z.string() }),
          ),
        }),
      )
      .query(({ ctx, input }) => {
        const nameFilters = input.filters
          .filter((f) => f.key === "name")
          .map((f) => like(target.name, `%${f.value}%`));
        const kindFilters = input.filters
          .filter((f) => f.key === "kind")
          .map((f) => eq(target.kind, f.value));

        return ctx.db
          .select()
          .from(target)
          .innerJoin(targetProvider, eq(target.providerId, targetProvider.id))
          .innerJoin(workspace, eq(targetProvider.workspaceId, workspace.id))
          .where(
            and(
              eq(workspace.id, input.workspaceId),
              or(...nameFilters),
              or(...kindFilters),
            ),
          )
          .orderBy(desc(target.kind))
          .then((t) =>
            t.map((a) => ({ ...a.target, provider: a.target_provider })),
          );
      }),
  }),

  create: protectedProcedure
    .input(createTarget)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(target).values(input).returning().then(takeFirst),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateTarget }))
    .mutation(({ ctx, input: { id, data } }) =>
      ctx.db
        .update(target)
        .set(data)
        .where(eq(target.id, id))
        .returning()
        .then(takeFirst),
    ),

  labelKeys: protectedProcedure
    .input(z.string().optional())
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ key: sql<string>`jsonb_object_keys(labels)` })
        .from(target)
        .where(input != null ? eq(target.workspaceId, input) : undefined)
        .then((r) => r.map((row) => row.key)),
    ),

  lock: protectedProcedure
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(target)
        .set({ lockedAt: new Date() })
        .where(eq(target.id, input))
        .returning()
        .then(takeFirst),
    ),

  unlock: protectedProcedure
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(target)
        .set({ lockedAt: null })
        .where(eq(target.id, input))
        .returning()
        .then(takeFirst),
    ),
});
