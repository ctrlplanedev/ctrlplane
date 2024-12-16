import ms from "ms";
import { z } from "zod";

import {
  and,
  eq,
  inArray,
  isNull,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createResourceProvider,
  createResourceProviderAws,
  createResourceProviderGoogle,
  resource,
  resourceProvider,
  resourceProviderAws,
  resourceProviderGoogle,
  updateResourceProviderAws,
  updateResourceProviderGoogle,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { resourceScanQueue } from "../dispatch";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const resourceProviderRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
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
        .leftJoin(
          resourceProviderAws,
          eq(resourceProviderAws.resourceProviderId, resourceProvider.id),
        )
        .where(eq(resourceProvider.workspaceId, input));

      if (providers.length === 0) return [];

      const providerCounts = await ctx.db
        .select({
          providerId: resource.providerId,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(resource)
        .where(
          and(
            inArray(
              resource.providerId,
              providers.map((p) => p.resource_provider.id),
            ),
            isNull(resource.deletedAt),
          ),
        )
        .groupBy(resource.providerId);

      const providerKinds = await ctx.db
        .select({
          providerId: resource.providerId,
          kind: resource.kind,
          version: resource.version,
          count: sql<number>`count(*)`.as("count"),
        })
        .from(resource)
        .where(
          and(
            inArray(
              resource.providerId,
              providers.map((p) => p.resource_provider.id),
            ),
            isNull(resource.deletedAt),
          ),
        )
        .groupBy(resource.providerId, resource.kind, resource.version)
        .orderBy(sql`count(*) DESC`);

      return providers.map((provider) => ({
        ...provider.resource_provider,
        googleConfig: provider.resource_provider_google,
        awsConfig: provider.resource_provider_aws,
        resourceCount:
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
          .perform(Permission.ResourceList)
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
            .perform(Permission.ResourceProviderUpdate)
            .on({ type: "resourceProvider", id: input }),
      })
      .input(z.string().uuid())
      .mutation(({ input }) =>
        resourceScanQueue.add(input, { resourceProviderId: input }),
      ),

    google: createTRPCRouter({
      create: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(
                Permission.ResourceCreate,
                Permission.ResourceProviderUpdate,
              )
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .input(
          createResourceProvider.and(
            z.object({
              config: createResourceProviderGoogle.omit({
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

            await resourceScanQueue.add(
              tg.id,
              { resourceProviderId: tg.id },
              { repeat: { every: ms("10m"), immediately: true } },
            );

            return { ...tg, config: tgConfig };
          }),
        ),

      update: protectedProcedure
        .input(
          z.object({
            resourceProviderId: z.string().uuid(),
            name: z.string().optional(),
            config: updateResourceProviderGoogle.omit({
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
                .where(eq(resourceProvider.id, input.resourceProviderId))
                .returning()
                .then(takeFirst);

            await db
              .update(resourceProviderGoogle)
              .set(input.config)
              .where(
                eq(
                  resourceProviderGoogle.resourceProviderId,
                  input.resourceProviderId,
                ),
              )
              .returning()
              .then(takeFirst);

            if (input.repeatSeconds != null) {
              await resourceScanQueue.remove(input.resourceProviderId);
              await resourceScanQueue.add(
                input.resourceProviderId,
                { resourceProviderId: input.resourceProviderId },
                {
                  repeat: {
                    every: input.repeatSeconds * 1000,
                    immediately: true,
                  },
                },
              );
              return;
            }

            await resourceScanQueue.add(input.resourceProviderId, {
              resourceProviderId: input.resourceProviderId,
            });
          });
        }),
    }),
    aws: createTRPCRouter({
      create: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(
                Permission.ResourceCreate,
                Permission.ResourceProviderUpdate,
              )
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .input(
          createResourceProvider.and(
            z.object({
              config: createResourceProviderAws.omit({
                resourceProviderId: true,
              }),
            }),
          ),
        )
        .mutation(({ ctx, input }) =>
          ctx.db.transaction(async (db) => {
            const provider = await db
              .insert(resourceProvider)
              .values(input)
              .returning()
              .then(takeFirst);

            const providerConfig = await db
              .insert(resourceProviderAws)
              .values({ ...input.config, resourceProviderId: provider.id })
              .returning()
              .then(takeFirst);

            await resourceScanQueue.add(
              provider.id,
              { resourceProviderId: provider.id },
              { repeat: { every: ms("10m"), immediately: true } },
            );

            return { ...provider, config: providerConfig };
          }),
        ),

      update: protectedProcedure
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.ResourceProviderUpdate)
              .on({ type: "resourceProvider", id: input.resourceProviderId }),
        })
        .input(
          z.object({
            resourceProviderId: z.string().uuid(),
            name: z.string().optional(),
            config: updateResourceProviderAws.omit({
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
                .where(eq(resourceProvider.id, input.resourceProviderId))
                .returning()
                .then(takeFirst);

            await db
              .update(resourceProviderAws)
              .set(input.config)
              .where(
                eq(
                  resourceProviderAws.resourceProviderId,
                  input.resourceProviderId,
                ),
              )
              .returning()
              .then(takeFirst);

            if (input.repeatSeconds != null) {
              await resourceScanQueue.remove(input.resourceProviderId);
              await resourceScanQueue.add(
                input.resourceProviderId,
                { resourceProviderId: input.resourceProviderId },
                {
                  repeat: {
                    every: input.repeatSeconds * 1000,
                    immediately: true,
                  },
                },
              );
              return;
            }
            await resourceScanQueue.add(input.resourceProviderId, {
              resourceProviderId: input.resourceProviderId,
            });
          });
        }),
    }),
  }),
  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceDelete)
          .on({ type: "resourceProvider", id: input.providerId }),
    })
    .input(
      z.object({
        providerId: z.string().uuid(),
        deleteResources: z.boolean().optional().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        if (input.deleteResources)
          await tx
            .update(resource)
            .set({ deletedAt: new Date() })
            .where(eq(resource.providerId, input.providerId));

        const deletedProvider = await tx
          .delete(resourceProvider)
          .where(eq(resourceProvider.id, input.providerId))
          .returning()
          .then(takeFirst);

        // We should think about the edge case here, if a scan is in progress,
        // what do we do?
        await resourceScanQueue.remove(input.providerId);

        return deletedProvider;
      }),
    ),
});
