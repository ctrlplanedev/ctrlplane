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
  azureTenant,
  createResourceProvider,
  createResourceProviderAws,
  createResourceProviderGoogle,
  resource,
  resourceProvider,
  resourceProviderAws,
  resourceProviderAzure,
  resourceProviderGithubRepo,
  resourceProviderGoogle,
  updateResourceProviderAws,
  updateResourceProviderGoogle,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";
import { resourceProviderPageRouter } from "../resource-provider-page/router";

export const resourceProviderRouter = createTRPCRouter({
  page: resourceProviderPageRouter,

  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const azureConfigSubquery = ctx.db
        .select({
          id: resourceProviderAzure.id,
          tenantId: azureTenant.tenantId,
          subscriptionId: resourceProviderAzure.subscriptionId,
          resourceProviderId: resourceProviderAzure.resourceProviderId,
        })
        .from(resourceProviderAzure)
        .innerJoin(
          azureTenant,
          eq(resourceProviderAzure.tenantId, azureTenant.id),
        )
        .as("azureConfig");

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
        .leftJoin(
          azureConfigSubquery,
          eq(azureConfigSubquery.resourceProviderId, resourceProvider.id),
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
        azureConfig: provider.azureConfig,
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
        .leftJoin(
          resourceProviderGoogle,
          eq(resourceProviderGoogle.resourceProviderId, resourceProvider.id),
        )
        .leftJoin(
          resourceProviderAws,
          eq(resourceProviderAws.resourceProviderId, resourceProvider.id),
        )
        .leftJoin(
          resourceProviderAzure,
          eq(resourceProviderAzure.resourceProviderId, resourceProvider.id),
        )
        .leftJoin(resource, eq(resource.providerId, resourceProvider.id))
        .where(eq(resourceProvider.id, input))
        .then((rows) => {
          const row = rows.at(0);
          if (row == null) return null;
          return {
            ...row.resource_provider,
            googleConfig: row.resource_provider_google,
            awsConfig: row.resource_provider_aws,
            azureConfig: row.resource_provider_azure,
          };
        }),
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
      .mutation(() => void 0),

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
              return;
            }
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
              return;
            }
          });
        }),
    }),
    azure: createTRPCRouter({
      byProviderId: protectedProcedure
        .input(z.string().uuid())
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.ResourceProviderGet)
              .on({ type: "resourceProvider", id: input }),
        })
        .query(({ ctx, input }) =>
          ctx.db
            .select()
            .from(resourceProviderAzure)
            .innerJoin(
              azureTenant,
              eq(resourceProviderAzure.tenantId, azureTenant.id),
            )
            .where(eq(resourceProviderAzure.resourceProviderId, input))
            .then(takeFirstOrNull),
        ),

      update: protectedProcedure
        .input(
          z.object({
            resourceProviderId: z.string().uuid(),
            name: z.string(),
          }),
        )
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.ResourceProviderUpdate)
              .on({ type: "resourceProvider", id: input.resourceProviderId }),
        })
        .mutation(({ ctx, input }) =>
          ctx.db
            .update(resourceProvider)
            .set({ name: input.name })
            .where(eq(resourceProvider.id, input.resourceProviderId))
            .returning()
            .then(takeFirst),
        ),
    }),

    github: createTRPCRouter({
      create: protectedProcedure
        .input(
          z.object({
            workspaceId: z.string().uuid(),
            entityId: z.string().uuid(),
            repositoryId: z.number(),
            name: z.string(),
          }),
        )
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.ResourceProviderCreate)
              .on({ type: "workspace", id: input.workspaceId }),
        })
        .mutation(({ ctx, input }) =>
          ctx.db.transaction(async (tx) => {
            const provider = await tx
              .insert(resourceProvider)
              .values({
                workspaceId: input.workspaceId,
                name: input.name,
              })
              .returning()
              .then(takeFirst);

            await tx.insert(resourceProviderGithubRepo).values({
              resourceProviderId: provider.id,
              githubEntityId: input.entityId,
              repoId: input.repositoryId,
            });

            return provider;
          }),
        ),

      update: protectedProcedure
        .input(
          z.object({
            resourceProviderId: z.string().uuid(),
            name: z.string().optional(),
            entityId: z.string().uuid().optional(),
            repositoryId: z.number().optional(),
          }),
        )
        .meta({
          authorizationCheck: ({ canUser, input }) =>
            canUser
              .perform(Permission.ResourceProviderUpdate)
              .on({ type: "resourceProvider", id: input.resourceProviderId }),
        })
        .mutation(({ ctx, input }) =>
          ctx.db.transaction(async (tx) => {
            if (input.name != null)
              await tx
                .update(resourceProvider)
                .set({ name: input.name })
                .where(eq(resourceProvider.id, input.resourceProviderId));

            const repoProviderUpdates = {
              repoId: input.repositoryId,
              githubEntityId: input.entityId,
            };

            await tx
              .update(resourceProviderGithubRepo)
              .set(repoProviderUpdates)
              .where(
                eq(
                  resourceProviderGithubRepo.resourceProviderId,
                  input.resourceProviderId,
                ),
              );
          }),
        ),
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

        return deletedProvider;
      }),
    ),
});
