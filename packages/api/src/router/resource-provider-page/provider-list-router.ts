import { z } from "zod";

import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  isNotNull,
  isNull,
  max,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../../trpc";

const getProviderTypeCondition = (
  type?: "aws" | "google" | "azure" | "custom",
) => {
  if (type === "aws") return isNotNull(SCHEMA.resourceProviderAws.id);
  if (type === "google") return isNotNull(SCHEMA.resourceProviderGoogle.id);
  if (type === "azure") return isNotNull(SCHEMA.resourceProviderAzure.id);
  if (type === "custom")
    return and(
      isNull(SCHEMA.resourceProviderGoogle.id),
      isNull(SCHEMA.resourceProviderAws.id),
      isNull(SCHEMA.resourceProviderAzure.id),
    );
  return undefined;
};

const getSortCondition = (sort: string, ascending: boolean) => {
  const order = ascending ? asc : desc;
  if (sort === "name") return order(SCHEMA.resourceProvider.name);
  if (sort === "createdAt") return order(SCHEMA.resourceProvider.createdAt);
  if (sort === "lastSyncedAt") return order(max(SCHEMA.resource.updatedAt));
  return order(count(SCHEMA.resource.id));
};

export const providerListRouter = createTRPCRouter({
  byWorkspaceId: createTRPCRouter({
    count: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ ctx, input }) =>
        ctx.db
          .select({ count: count() })
          .from(SCHEMA.resourceProvider)
          .where(eq(SCHEMA.resourceProvider.workspaceId, input.workspaceId))
          .then(takeFirst)
          .then((result) => result.count),
      ),
    list: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          limit: z.number().default(12),
          offset: z.number().default(0),
          type: z.enum(["aws", "google", "azure", "custom"]).optional(),
          search: z.string().optional(),
          sort: z
            .enum(["name", "createdAt", "lastSyncedAt", "totalResources"])
            .default("name"),
          asc: z.boolean().default(true),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.ResourceProviderGet)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .query(async ({ ctx, input }) =>
        ctx.db
          .select({
            id: SCHEMA.resourceProvider.id,
            name: SCHEMA.resourceProvider.name,
            createdAt: SCHEMA.resourceProvider.createdAt,
            type: sql<"google" | "aws" | "azure" | "custom">`
            CASE
              WHEN ${isNotNull(SCHEMA.resourceProviderGoogle.resourceProviderId)} THEN 'google'
              WHEN ${isNotNull(SCHEMA.resourceProviderAws.resourceProviderId)} THEN 'aws'
              WHEN ${isNotNull(SCHEMA.resourceProviderAzure.resourceProviderId)} THEN 'azure'
              ELSE 'custom'
            END
          `.as("type"),
            totalResources: count(SCHEMA.resource.id),
            kinds: sql<Array<string>>`COALESCE(
              json_agg(DISTINCT ${SCHEMA.resource.kind}) FILTER (WHERE ${isNotNull(SCHEMA.resource.kind)}),
              '[]'::json
            )`.as("kinds"),
            lastSyncedAt: max(SCHEMA.resource.updatedAt),
          })
          .from(SCHEMA.resourceProvider)
          .leftJoin(
            SCHEMA.resourceProviderGoogle,
            eq(
              SCHEMA.resourceProviderGoogle.resourceProviderId,
              SCHEMA.resourceProvider.id,
            ),
          )
          .leftJoin(
            SCHEMA.resourceProviderAws,
            eq(
              SCHEMA.resourceProviderAws.resourceProviderId,
              SCHEMA.resourceProvider.id,
            ),
          )
          .leftJoin(
            SCHEMA.resourceProviderAzure,
            eq(
              SCHEMA.resourceProviderAzure.resourceProviderId,
              SCHEMA.resourceProvider.id,
            ),
          )
          .leftJoin(
            SCHEMA.resource,
            eq(SCHEMA.resource.providerId, SCHEMA.resourceProvider.id),
          )
          .where(
            and(
              eq(SCHEMA.resourceProvider.workspaceId, input.workspaceId),
              isNull(SCHEMA.resource.deletedAt),
              getProviderTypeCondition(input.type),
              input.search
                ? ilike(SCHEMA.resourceProvider.name, `%${input.search}%`)
                : undefined,
            ),
          )
          .groupBy(
            SCHEMA.resourceProvider.id,
            SCHEMA.resourceProviderGoogle.id,
            SCHEMA.resourceProviderAws.id,
            SCHEMA.resourceProviderAzure.id,
          )
          .orderBy(getSortCondition(input.sort, input.asc))
          .limit(input.limit)
          .offset(input.offset),
      ),
  }),
});
