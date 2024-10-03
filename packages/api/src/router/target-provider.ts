import ms from "ms";
import { z } from "zod";

import { eq, inArray, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  createTargetProvider,
  createTargetProviderGoogle,
  target,
  targetProvider,
  targetProviderGoogle,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { targetScanQueue } from "../dispatch";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const targetProviderRouter = createTRPCRouter({
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
          version: target.version,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(target)
        .where(
          inArray(
            target.providerId,
            providers.map((p) => p.target_provider.id),
          ),
        )
        .groupBy(target.providerId, target.kind, target.version)
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
          .map(({ kind, version, count }) => ({ kind, version, count })),
      }));
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "targetProvider", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(targetProvider)
        .where(eq(targetProvider.id, input))
        .then(takeFirstOrNull),
    ),

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
              { repeat: { every: ms("10m"), immediately: true } },
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
