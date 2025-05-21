import type { SQL, Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  not,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  getResourceChildren,
  getResourceParents,
  getResourceRelationshipRules,
} from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { getReferenceVariableValue } from "@ctrlplane/rule-engine";
import { Permission } from "@ctrlplane/validators/auth";
import { resourceCondition } from "@ctrlplane/validators/resources";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { resourceMetadataGroupRouter } from "./resource-metadata-group";
import { resourceProviderRouter } from "./resource-provider";
import { resourceRelationshipRulesRouter } from "./resource-relationship-rules";
import { resourceVariables } from "./resource-variables";
import { resourceViews } from "./resource-views";

const isNotDeleted = isNull(schema.resource.deletedAt);

type _StringStringRecord = Record<string, string>;
const resourceQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select({
      resource: schema.resource,
      resourceProvider: schema.resourceProvider,
      workspace: schema.workspace,
      resourceMetadata: sql<_StringStringRecord>`
        jsonb_object_agg(resource_metadata.key, resource_metadata.value) 
        FILTER (WHERE resource_metadata.key IS NOT NULL)
      `.as("resource_metadata"),
    })
    .from(schema.resource)
    .leftJoin(
      schema.resourceProvider,
      eq(schema.resource.providerId, schema.resourceProvider.id),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.resource.workspaceId, schema.workspace.id),
    )
    .leftJoin(
      schema.resourceMetadata,
      eq(schema.resourceMetadata.resourceId, schema.resource.id),
    )
    .where(and(...checks))
    .groupBy(
      schema.resource.id,
      schema.resourceProvider.id,
      schema.workspace.id,
    );

export const resourceRouter = createTRPCRouter({
  metadataGroup: resourceMetadataGroupRouter,
  provider: resourceProviderRouter,
  view: resourceViews,
  variable: resourceVariables,
  relationshipRules: resourceRelationshipRulesRouter,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceGet)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const resource = await ctx.db.query.resource.findFirst({
        where: and(eq(schema.resource.id, input), isNotDeleted),
        with: { metadata: true, variables: true, provider: true },
      });
      if (resource == null) return null;

      const { relationships } = await getResourceParents(ctx.db, resource.id);

      const parsedVariables = resource.variables
        .map((v) => {
          const parsed = schema.resourceVariableSchema.safeParse(v);
          if (!parsed.success) return null;
          return parsed.data;
        })
        .filter(isPresent);

      const directVariables = parsedVariables.filter(
        (v): v is schema.DirectResourceVariable => v.valueType === "direct",
      );

      const referenceVariables = parsedVariables.filter(
        (v): v is schema.ReferenceResourceVariable =>
          v.valueType === "reference",
      );

      const resolvedReferenceVariables = await Promise.all(
        referenceVariables.map(async (v) => {
          const resolvedValue = await getReferenceVariableValue(resource.id, v);
          return { ...v, resolvedValue };
        }),
      );

      const metadata = Object.fromEntries(
        resource.metadata.map((m) => [m.key, m.value]),
      );

      return {
        ...resource,
        relationships,
        directVariables,
        referenceVariables: resolvedReferenceVariables,
        metadata,
        rules: await getResourceRelationshipRules(ctx.db, resource.id),
      };
    }),

  relationships: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceGet)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const resource = await ctx.db
        .select()
        .from(schema.resource)
        .where(eq(schema.resource.id, input))
        .then(takeFirst);

      const { relationships: parents } = await getResourceParents(
        ctx.db,
        resource.id,
      );
      const children = await getResourceChildren(ctx.db, resource.id);

      return { resource, parents, children };
    }),

  byWorkspaceId: createTRPCRouter({
    list: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.ResourceList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          filter: resourceCondition.optional(),
          limit: z.number().int().nonnegative().max(1000).default(200),
          offset: z.number().int().nonnegative().default(0),
          orderBy: z
            .array(
              z.object({
                property: z.enum(["kind", "name", "createdAt"]),
                direction: z.enum(["asc", "desc"]).optional().default("asc"),
              }),
            )
            .optional(),
        }),
      )
      .query(({ ctx, input }) => {
        const workspaceIdCheck = eq(
          schema.resource.workspaceId,
          input.workspaceId,
        );
        const resourceConditions = schema.resourceMatchesMetadata(
          ctx.db,
          input.filter,
        );
        const checks = [
          workspaceIdCheck,
          resourceConditions,
          isNotDeleted,
        ].filter(isPresent);

        const properties = {
          kind: schema.resource.kind,
          name: schema.resource.name,
          createdAt: schema.resource.createdAt,
        };

        const orderBy: SQL[] = input.orderBy
          ? []
          : [asc(schema.resource.kind), asc(schema.resource.name)];

        if (input.orderBy)
          for (const order of input.orderBy) {
            const column = properties[order.property];
            orderBy.push(
              order.direction === "asc" ? asc(column) : desc(column),
            );
          }

        const items = resourceQuery(ctx.db, checks)
          .limit(input.limit)
          .offset(input.offset)
          .orderBy(...orderBy)
          .then((t) =>
            t.map((a) => ({
              ...a.resource,
              provider: a.resourceProvider,
              metadata: a.resourceMetadata,
            })),
          );

        const total = ctx.db
          .select({ count: sql`COUNT(*)`.mapWith(Number) })
          .from(schema.resource)
          .where(and(...checks))
          .then(takeFirst)
          .then((t) => t.count);

        return Promise.all([items, total]).then(([items, total]) => ({
          items,
          total,
        }));
      }),
  }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      schema.createResource.and(z.object({ metadata: z.record(z.string()) })),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const tg = await tx
          .insert(schema.resource)
          .values(input)
          .returning()
          .then(takeFirst);

        await tx.insert(schema.resourceMetadata).values(
          Object.entries(input.metadata).map(([key, value]) => ({
            resourceId: tg.id,
            key,
            value,
          })),
        );

        return tg;
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: schema.updateResource.and(
          z.object({ metadata: z.record(z.string()) }),
        ),
      }),
    )
    .mutation(async ({ ctx, input: { id, data } }) =>
      ctx.db.transaction(async (tx) => {
        const updatedResource = await tx
          .update(schema.resource)
          .set(data)
          .where(and(eq(schema.resource.id, id), isNotDeleted))
          .returning()
          .then(takeFirstOrNull);
        if (updatedResource == null) return null;

        const metadataEntries = Object.entries(data.metadata).map(
          ([key, value]) => ({
            resourceId: id,
            key,
            value,
          }),
        );

        await tx
          .insert(schema.resourceMetadata)
          .values(metadataEntries)
          .onConflictDoUpdate({
            target: [
              schema.resourceMetadata.resourceId,
              schema.resourceMetadata.key,
            ],
            set: { value: sql`EXCLUDED.value` },
          })
          .then(() =>
            tx
              .delete(schema.resourceMetadata)
              .where(
                and(
                  eq(schema.resourceMetadata.resourceId, id),
                  not(
                    inArray(
                      schema.resourceMetadata.key,
                      Object.keys(data.metadata),
                    ),
                  ),
                ),
              ),
          );

        return updatedResource;
      }),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ResourceDelete).on(
          ...(input as string[]).map((t) => ({
            type: "resource" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .mutation(async ({ ctx, input }) => {
      const resources = await ctx.db.query.resource.findMany({
        where: and(inArray(schema.resource.id, input), isNotDeleted),
      });
      await getQueue(Channel.DeleteResource).addBulk(
        resources.map((r) => ({ name: r.id, data: r })),
      );
      return resources;
    }),

  metadataKeys: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ key: schema.resourceMetadata.key })
        .from(schema.resource)
        .innerJoin(
          schema.resourceMetadata,
          eq(schema.resourceMetadata.resourceId, schema.resource.id),
        )
        .where(and(eq(schema.resource.workspaceId, input), isNotDeleted))
        .then((r) => r.map((row) => row.key)),
    ),

  versions: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceList)
          .on({ type: "workspace", id: input }),
    })
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ version: schema.resource.version })
        .from(schema.resource)
        .where(and(eq(schema.resource.workspaceId, input), isNotDeleted))
        .then((r) => r.map((row) => row.version)),
    ),

  lock: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(schema.resource)
        .set({ lockedAt: new Date() })
        .where(and(eq(schema.resource.id, input), isNotDeleted))
        .returning()
        .then(takeFirst),
    ),

  unlock: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ResourceUpdate)
          .on({ type: "resource", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(schema.resource)
        .set({ lockedAt: null })
        .where(and(eq(schema.resource.id, input), isNotDeleted))
        .returning()
        .then(takeFirst),
    ),
});
