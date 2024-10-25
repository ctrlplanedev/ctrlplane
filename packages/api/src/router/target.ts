import type { SQL, Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  count,
  eq,
  inArray,
  not,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { variablesAES256 } from "@ctrlplane/secrets";
import { Permission } from "@ctrlplane/validators/auth";
import { targetCondition } from "@ctrlplane/validators/targets";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { targetMetadataGroupRouter } from "./target-metadata-group";
import { targetProviderRouter } from "./target-provider";

const targetRelations = createTRPCRouter({
  hierarchy: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const results = await ctx.db.execute(
        sql`
          WITH RECURSIVE reachable_relationships(id, visited, tr_id, source_id, target_id, type) AS (
            -- Base case: start with the given ID and no relationship
            SELECT 
                ${input}::uuid AS id, 
                ARRAY[${input}::uuid] AS visited,
                NULL::uuid AS tr_id,
                NULL::uuid AS source_id,
                NULL::uuid AS target_id,
                NULL::target_relationship_type AS type
            UNION ALL
            -- Recursive case: find all relationships connected to the current set of IDs
            SELECT
                CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END AS id,
                rr.visited || CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END,
                tr.id AS tr_id,
                tr.source_id,
                tr.target_id,
                tr.type
            FROM reachable_relationships rr
            JOIN target_relationship tr ON tr.source_id = rr.id OR tr.target_id = rr.id
            WHERE
                NOT CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END = ANY(rr.visited)
        )
        SELECT DISTINCT tr_id AS id, source_id, target_id, type
        FROM reachable_relationships
        WHERE tr_id IS NOT NULL;
        `,
      );

      // db.execute does not return the types even if the sql`` is annotated with the type
      // so we need to cast them here
      const relationships = results.rows.map((r) => ({
        id: String(r.id),
        sourceId: String(r.source_id),
        targetId: String(r.target_id),
        type: r.type as "associated_with" | "depends_on",
      }));

      const sourceIds = relationships.map((r) => r.sourceId);
      const targetIds = relationships.map((r) => r.targetId);

      const allIds = _.uniq([...sourceIds, ...targetIds, input]);

      const targets = await ctx.db
        .select()
        .from(schema.target)
        .where(inArray(schema.target.id, allIds));

      return { relationships, targets };
    }),
});

const targetViews = createTRPCRouter({
  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(schema.createTargetView)
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .insert(schema.targetView)
        .values(input)
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewUpdate)
          .on({ type: "targetView", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: schema.updateTargetView }))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .update(schema.targetView)
        .set(input.data)
        .where(eq(schema.targetView.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewDelete)
          .on({ type: "targetView", id: input }),
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) =>
      ctx.db.delete(schema.targetView).where(eq(schema.targetView.id, input)),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewGet)
          .on({ type: "targetView", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(schema.targetView)
        .where(eq(schema.targetView.id, input))
        .then(takeFirst),
    ),

  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetViewList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const views = await ctx.db
        .select()
        .from(schema.targetView)
        .orderBy(schema.targetView.name)
        .where(eq(schema.targetView.workspaceId, input));

      return Promise.all(
        views.map(async (view) => {
          const total = await ctx.db
            .select({ count: count() })
            .from(schema.target)
            .where(schema.targetMatchesMetadata(ctx.db, view.filter))
            .then(takeFirst)
            .then((t) => t.count);

          return {
            ...view,
            total,
          };
        }),
      );
    }),
});

const targetVariables = createTRPCRouter({
  create: protectedProcedure
    .input(schema.createTargetVariable)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input.targetId }),
    })
    .mutation(async ({ ctx, input }) => {
      const { sensitive } = input;
      const value = sensitive
        ? variablesAES256().encrypt(String(input.value))
        : input.value;
      const data = { ...input, value };
      return ctx.db.insert(schema.targetVariable).values(data).returning();
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.string().uuid(), data: schema.updateTargetVariable }),
    )
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const variable = await ctx.db
          .select()
          .from(schema.targetVariable)
          .where(eq(schema.targetVariable.id, input.id))
          .then(takeFirstOrNull);
        if (!variable) return false;

        return canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: variable.targetId });
      },
    })
    .mutation(async ({ ctx, input }) => {
      const { sensitive } = input.data;
      const value = sensitive
        ? variablesAES256().encrypt(String(input.data.value))
        : input.data.value;
      const data = { ...input.data, value };
      return ctx.db
        .update(schema.targetVariable)
        .set(data)
        .where(eq(schema.targetVariable.id, input.id))
        .returning()
        .then(takeFirst);
    }),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ ctx, canUser, input }) => {
        const variable = await ctx.db
          .select()
          .from(schema.targetVariable)
          .where(eq(schema.targetVariable.id, input))
          .then(takeFirstOrNull);
        if (!variable) return false;

        return canUser
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: variable.targetId });
      },
    })
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(schema.targetVariable)
        .where(eq(schema.targetVariable.id, input)),
    ),
});

type _StringStringRecord = Record<string, string>;
const targetQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select({
      target: schema.target,
      targetProvider: schema.targetProvider,
      workspace: schema.workspace,
      targetMetadata: sql<_StringStringRecord>`
        jsonb_object_agg(target_metadata.key, target_metadata.value) 
        FILTER (WHERE target_metadata.key IS NOT NULL)
      `.as("target_metadata"),
    })
    .from(schema.target)
    .leftJoin(
      schema.targetProvider,
      eq(schema.target.providerId, schema.targetProvider.id),
    )
    .innerJoin(
      schema.workspace,
      eq(schema.target.workspaceId, schema.workspace.id),
    )
    .leftJoin(
      schema.targetMetadata,
      eq(schema.targetMetadata.targetId, schema.target.id),
    )
    .where(and(...checks))
    .groupBy(schema.target.id, schema.targetProvider.id, schema.workspace.id)
    .orderBy(asc(schema.target.kind), asc(schema.target.name));

export const targetRouter = createTRPCRouter({
  metadataGroup: targetMetadataGroupRouter,
  provider: targetProviderRouter,
  relations: targetRelations,
  view: targetViews,
  variable: targetVariables,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.TargetGet).on({ type: "target", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.query.target
        .findFirst({
          where: eq(schema.target.id, input),
          with: { metadata: true, variables: true, provider: true },
        })
        .then((t) => {
          if (t == null) return null;
          const pairs = t.metadata.map((m) => [m.key, m.value]);
          const metadata = Object.fromEntries(pairs);
          return { ...t, metadata };
        }),
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
          filter: targetCondition.optional(),
          limit: z.number().int().nonnegative().max(1000).default(500),
          offset: z.number().int().nonnegative().default(0),
        }),
      )
      .query(({ ctx, input }) => {
        const workspaceIdCheck = eq(
          schema.target.workspaceId,
          input.workspaceId,
        );
        const targetConditions = schema.targetMatchesMetadata(
          ctx.db,
          input.filter,
        );
        const checks = [workspaceIdCheck, targetConditions].filter(isPresent);

        const items = targetQuery(ctx.db, checks)
          .limit(input.limit)
          .offset(input.offset)
          .then((t) =>
            t.map((a) => ({
              ...a.target,
              provider: a.targetProvider,
              metadata: a.targetMetadata,
            })),
          );

        const total = ctx.db
          .select({
            count: sql`COUNT(*)`.mapWith(Number),
          })
          .from(schema.target)
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
          .perform(Permission.TargetCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      schema.createTarget.and(z.object({ metadata: z.record(z.string()) })),
    )
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const tg = await tx
          .insert(schema.target)
          .values(input)
          .returning()
          .then(takeFirst);

        await tx.insert(schema.targetMetadata).values(
          Object.entries(input.metadata).map(([key, value]) => ({
            targetId: tg.id,
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
          .perform(Permission.TargetUpdate)
          .on({ type: "target", id: input.id }),
    })
    .input(
      z.object({
        id: z.string().uuid(),
        data: schema.updateTarget.and(
          z.object({ metadata: z.record(z.string()) }),
        ),
      }),
    )
    .mutation(async ({ ctx, input: { id, data } }) =>
      ctx.db.transaction(async (tx) => {
        const updatedTarget = await tx
          .update(schema.target)
          .set(data)
          .where(eq(schema.target.id, id))
          .returning()
          .then(takeFirst);

        const metadataEntries = Object.entries(data.metadata).map(
          ([key, value]) => ({
            targetId: id,
            key,
            value,
          }),
        );

        await tx
          .insert(schema.targetMetadata)
          .values(metadataEntries)
          .onConflictDoUpdate({
            target: [schema.targetMetadata.targetId, schema.targetMetadata.key],
            set: { value: sql`EXCLUDED.value` },
          })
          .then(() =>
            tx
              .delete(schema.targetMetadata)
              .where(
                and(
                  eq(schema.targetMetadata.targetId, id),
                  not(
                    inArray(
                      schema.targetMetadata.key,
                      Object.keys(data.metadata),
                    ),
                  ),
                ),
              ),
          );

        return updatedTarget;
      }),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.TargetDelete).on(
          ...(input as string[]).map((t) => ({
            type: "target" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .mutation(async ({ ctx, input }) =>
      ctx.db
        .delete(schema.target)
        .where(inArray(schema.target.id, input))
        .returning(),
    ),

  metadataKeys: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.TargetList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ key: schema.targetMetadata.key })
        .from(schema.target)
        .innerJoin(
          schema.targetMetadata,
          eq(schema.targetMetadata.targetId, schema.target.id),
        )
        .where(eq(schema.target.workspaceId, input))
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
        .update(schema.target)
        .set({ lockedAt: new Date() })
        .where(eq(schema.target.id, input))
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
        .update(schema.target)
        .set({ lockedAt: null })
        .where(eq(schema.target.id, input))
        .returning()
        .then(takeFirst),
    ),
});
