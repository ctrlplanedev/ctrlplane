import type { SQL, Tx } from "@ctrlplane/db";
import ms from "ms";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createTarget,
  createTargetProvider,
  createTargetProviderGoogle,
  target,
  targetLabelGroup,
  targetProvider,
  targetProviderGoogle,
  updateTarget,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { targetScanQueue } from "../dispatch";
import { createTRPCRouter, protectedProcedure } from "../trpc";

const labelGroupRouter = createTRPCRouter({
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
        .innerJoin(target, sql`${target.labels} ?& ${targetLabelGroup.keys}`)
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

const targetProviderRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const providers = await ctx.db
        .select()
        .from(targetProvider)
        .leftJoin(
          targetProviderGoogle,
          eq(targetProviderGoogle.targetProviderId, targetProvider.id),
        )
        .where(eq(targetProvider.workspaceId, input));

      if (providers.length === 0) return [];

      const providerCounts = await ctx.db
        .select({
          providerId: target.providerId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(target)
        .where(
          inArray(
            target.providerId,
            providers.map((p) => p.target_provider.id),
          ),
        )
        .groupBy(target.providerId);

      const providerKinds = await ctx.db
        .select({
          providerId: target.providerId,
          kind: target.kind,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(target)
        .where(
          inArray(
            target.providerId,
            providers.map((p) => p.target_provider.id),
          ),
        )
        .groupBy(target.providerId, target.kind)
        .orderBy(sql`count(*) DESC`);

      return providers.map((provider) => ({
        ...provider.target_provider,
        googleConfig: provider.target_provider_google,
        targetCount:
          providerCounts.find(
            (pc) => pc.providerId === provider.target_provider.id,
          )?.count ?? 0,
        kinds: providerKinds
          .filter((pk) => pk.providerId === provider.target_provider.id)
          .map(({ kind, count }) => ({ kind, count })),
      }));
    }),

  managed: createTRPCRouter({
    google: createTRPCRouter({
      create: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.TargetUpdate)
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .input(
          createTargetProvider.and(
            z.object({
              config: createTargetProviderGoogle.omit({
                targetProviderId: true,
              }),
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

            console.log("queueing target scan");
            await targetScanQueue.add(
              tg.id,
              { targetProviderId: tg.id },
              { repeat: { every: ms("5m"), immediately: true } },
            );

            return { ...tg, config: tgConfig };
          }),
        ),

      update: protectedProcedure
        .input(
          z.object({
            targetProviderId: z.string().uuid(),
            name: z.string(),
            config: createTargetProviderGoogle.omit({
              targetProviderId: true,
            }),
          }),
        )
        .mutation(({ ctx, input }) =>
          ctx.db.transaction(async (db) =>
            db
              .update(targetProvider)
              .set(input)
              .where(eq(targetProvider.id, input.targetProviderId))
              .then(() =>
                db
                  .update(targetProviderGoogle)
                  .set(input.config)
                  .where(
                    eq(
                      targetProviderGoogle.targetProviderId,
                      input.targetProviderId,
                    ),
                  ),
              ),
          ),
        ),
    }),
  }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetDelete)
          .on({ type: "targetProvider", id: input.providerId }),
    })
    .input(
      z.object({
        providerId: z.string().uuid(),
        deleteTargets: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        if (input.deleteTargets)
          await tx
            .delete(target)
            .where(eq(target.providerId, input.providerId));

        const deletedProvider = await tx
          .delete(targetProvider)
          .where(eq(targetProvider.id, input.providerId))
          .returning()
          .then(takeFirst);

        // We should think about the edge case here, if a scan is in progress,
        // what do we do?
        await targetScanQueue.remove(input.providerId);

        return deletedProvider;
      }),
    ),
});

const targetQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select()
    .from(target)
    .leftJoin(targetProvider, eq(target.providerId, targetProvider.id))
    .innerJoin(workspace, eq(target.workspaceId, workspace.id))
    .where(and(...checks))
    .orderBy(desc(target.kind));

export const targetRouter = createTRPCRouter({
  labelGroup: labelGroupRouter,
  provider: targetProviderRouter,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.TargetGet).on({ type: "target", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(target)
        .leftJoin(targetProvider, eq(target.providerId, targetProvider.id))
        .where(eq(target.id, input))
        .then(takeFirstOrNull)
        .then((a) =>
          a == null ? null : { ...a.target, provider: a.target_provider },
        ),
    ),

  byWorkspaceId: createTRPCRouter({
    list: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.TargetList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .input(
        z.object({
          workspaceId: z.string().uuid(),
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
        const workspaceIdCheck = eq(workspace.id, input.workspaceId);

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

    kinds: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.TargetList)
            .on({ type: "workspace", id: input }),
      })
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .selectDistinct({ kind: target.kind })
          .from(target)
          .innerJoin(workspace, eq(target.workspaceId, workspace.id))
          .where(eq(workspace.id, input))
          .then((r) => r.map((row) => row.kind)),
      ),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createTarget)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(target).values(input).returning().then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateTarget }))
    .mutation(({ ctx, input: { id, data } }) =>
      ctx.db
        .update(target)
        .set(data)
        .where(eq(target.id, id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.TargetDelete).on(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unnecessary-type-assertion
          (input as any).map((t: any) => ({ type: "target" as const, id: t })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .mutation(async ({ ctx, input }) =>
      ctx.db.delete(target).where(inArray(target.id, input)).returning(),
    ),

  labelKeys: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ key: sql<string>`jsonb_object_keys(labels)` })
        .from(target)
        .where(eq(target.workspaceId, input))
        .then((r) => r.map((row) => row.key)),
    ),

  lock: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input }),
    })
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
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input }),
    })
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
