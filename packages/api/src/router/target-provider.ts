import ms from "ms";
import { z } from "zod";

import { eq, inArray, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import {
  createTargetProvider,
  createTargetProviderGoogle,
  resource,
  resourceProvider,
  resourceProviderGoogle,
  updateTargetProviderGoogle,
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
        .from(resourceProvider)
        .leftJoin(
          resourceProviderGoogle,
          eq(resourceProviderGoogle.resourceProviderId, resourceProvider.id),
        )
        .where(eq(resourceProvider.workspaceId, input));

      if (providers.length === 0) return [];

      const providerCounts = await ctx.db
        .select({
          providerId: resourceProvider.id,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(resource)
        .where(
          inArray(
            resource.providerId,
            providers.map((p) => p.resource_provider.id),
          ),
        )
        .groupBy(resourceProvider.id);

      const providerKinds = await ctx.db
        .select({
          providerId: resourceProvider.id,
          kind: resource.kind,
          version: resource.version,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(resource)
        .where(
          inArray(
            resource.providerId,
            providers.map((p) => p.resource_provider.id),
          ),
        )
        .groupBy(resourceProvider.id, resource.kind, resource.version)
        .orderBy(sql`count(*) DESC`);

      return providers.map((provider) => ({
        ...provider.resource_provider,
        googleConfig: provider.resource_provider_google,
        targetCount:
          providerCounts.find(
            (pc) => pc.providerId === provider.resource_provider.id,
          )?.count ?? 0,
        kinds: providerKinds
          .filter((pk) => pk.providerId === provider.resource_provider.id)
          .map(({ kind, version, count }) => ({ kind, version, count })),
      }));
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "resourceProvider", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(resourceProvider)
        .where(eq(resourceProvider.id, input))
        .then(takeFirstOrNull),
    ),

  managed: createTRPCRouter({
    sync: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.TargetProviderUpdate)
            .on({ type: "resourceProvider", id: input }),
      })
      .input(z.string().uuid())
      .mutation(async ({ input }) =>
        targetScanQueue.add(input, { targetProviderId: input }),
      ),

    google: createTRPCRouter({
      create: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.TargetCreate, Permission.TargetProviderUpdate)
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .input(
          createTargetProvider.and(
            z.object({
              config: createTargetProviderGoogle.omit({
                resourceProviderId: true,
              }),
            }),
          ),
        )
        .mutation(({ ctx, input }) =>
          ctx.db.transaction(async (db) => {
            const tg = await db
              .insert(resourceProvider)
              .values(input)
              .returning()
              .then(takeFirst);
            const tgConfig = await db
              .insert(resourceProviderGoogle)
              .values({ ...input.config, resourceProviderId: tg.id })
              .returning()
              .then(takeFirst);

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
            name: z.string().optional(),
            config: updateTargetProviderGoogle.omit({
              resourceProviderId: true,
            }),
            repeatSeconds: z.number().min(1).nullable(),
          }),
        )
        .mutation(({ ctx, input }) => {
          return ctx.db.transaction(async (db) => {
            if (input.name != null)
              await db
                .update(resourceProvider)
                .set({ name: input.name })
                .where(eq(resourceProvider.id, input.targetProviderId))
                .returning()
                .then(takeFirst);

            await db
              .update(resourceProviderGoogle)
              .set(input.config)
              .where(
                eq(
                  resourceProviderGoogle.resourceProviderId,
                  input.targetProviderId,
                ),
              )
              .returning()
              .then(takeFirst);

            if (input.repeatSeconds != null) {
              await targetScanQueue.remove(input.targetProviderId);
              await targetScanQueue.add(
                input.targetProviderId,
                { targetProviderId: input.targetProviderId },
                {
                  repeat: {
                    every: input.repeatSeconds * 1000,
                    immediately: true,
                  },
                },
              );
              return;
            }

            await targetScanQueue.add(input.targetProviderId, {
              targetProviderId: input.targetProviderId,
            });
          });
        }),
    }),
  }),
  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetDelete)
          .on({ type: "resourceProvider", id: input.providerId }),
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
            .delete(resource)
            .where(eq(resource.providerId, input.providerId));

        const deletedProvider = await tx
          .delete(resourceProvider)
          .where(eq(resourceProvider.id, input.providerId))
          .returning()
          .then(takeFirst);

        // We should think about the edge case here, if a scan is in progress,
        // what do we do?
        await targetScanQueue.remove(input.providerId);

        return deletedProvider;
      }),
    ),
});
