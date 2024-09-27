import type { SQL, Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  inArray,
  not,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createTarget,
  target,
  targetMatchesMetadata,
  targetMetadata,
  targetProvider,
  updateTarget,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { targetCondition } from "@ctrlplane/validators/targets";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { targetMetadataGroupRouter } from "./target-metadata-group";
import { targetProviderRouter } from "./target-provider";

const targetRelations = createTRPCRouter({
  hierarchy: protectedProcedure
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const results = await ctx.db.execute<{
        id: string;
        workpace_id: string;
        name: string;
        identifier: string;
        level: number;
        parent_identifier: string;
        parent_workspace_id: string;
      }>(
        sql`
          -- Recursive CTE to find ancestors (parents)
          WITH RECURSIVE ancestors AS (
              -- Base case: start with the given target id, including parent info if exists
              SELECT
                  t.id,
                  t.identifier,
                  t.workspace_id,
                  t.kind,
                  t.version,
                  t.name,
                  0 AS level,
                  ARRAY[t.id] AS path,
                  parent_tm.value AS parent_identifier,
                  parent_t.workspace_id AS parent_workspace_id
              FROM
                  target t
                  LEFT JOIN target_metadata parent_tm ON parent_tm.target_id = t.id AND parent_tm.key = 'ctrlplane/parent-target-identifier'
                  LEFT JOIN target parent_t ON parent_t.identifier = parent_tm.value AND parent_t.workspace_id = t.workspace_id
              WHERE
                  t.id = ${input}

              UNION ALL

              -- Recursive term: find the parent
              SELECT
                  parent_t.id,
                  parent_t.identifier,
                  parent_t.workspace_id,
                  parent_t.kind,
                  parent_t.version,
                  parent_t.name,  -- Added name
                  a.level - 1 AS level,
                  a.path || parent_t.id,
                  grandparent_tm.value AS parent_identifier,
                  grandparent_t.workspace_id AS parent_workspace_id
              FROM
                  ancestors a
                  JOIN target_metadata tm ON tm.target_id = a.id AND tm.key = 'ctrlplane/parent-target-identifier'
                  JOIN target parent_t ON parent_t.identifier = tm.value AND parent_t.workspace_id = a.workspace_id
                  LEFT JOIN target_metadata grandparent_tm ON grandparent_tm.target_id = parent_t.id AND grandparent_tm.key = 'ctrlplane/parent-target-identifier'
                  LEFT JOIN target grandparent_t ON grandparent_t.identifier = grandparent_tm.value AND grandparent_t.workspace_id = parent_t.workspace_id
              WHERE
                  NOT parent_t.id = ANY(a.path)
          ),

          -- Recursive CTE to find descendants (children)
          descendants AS (
              -- Base case: start with the given target id, including parent info if exists
              SELECT
                  t.id,
                  t.identifier,
                  t.workspace_id,
                  t.kind,
                  t.version,
                  t.name,
                  0 AS level,
                  ARRAY[t.id] AS path,
                  parent_tm.value AS parent_identifier,
                  parent_t.workspace_id AS parent_workspace_id
              FROM
                  target t
                  LEFT JOIN target_metadata parent_tm ON parent_tm.target_id = t.id AND parent_tm.key = 'ctrlplane/parent-target-identifier'
                  LEFT JOIN target parent_t ON parent_t.identifier = parent_tm.value AND parent_t.workspace_id = t.workspace_id
              WHERE
                  t.id = ${input}

              UNION ALL

              -- Recursive term: find the children
              SELECT
                  child_t.id,
                  child_t.identifier,
                  child_t.workspace_id,
                  child_t.kind,
                  child_t.version,
                  child_t.name,  -- Added name
                  d.level + 1 AS level,
                  d.path || child_t.id,
                  child_parent_tm.value AS parent_identifier,
                  child_parent_t.workspace_id AS parent_workspace_id
              FROM
                  descendants d
                  JOIN target_metadata tm ON tm.key = 'ctrlplane/parent-target-identifier' AND tm.value = d.identifier
                  JOIN target child_t ON child_t.id = tm.target_id AND child_t.workspace_id = d.workspace_id
                  LEFT JOIN target_metadata child_parent_tm ON child_parent_tm.target_id = child_t.id AND child_parent_tm.key = 'ctrlplane/parent-target-identifier'
                  LEFT JOIN target child_parent_t ON child_parent_t.identifier = child_parent_tm.value AND child_parent_t.workspace_id = child_t.workspace_id
              WHERE
                  NOT child_t.id = ANY(d.path)
          )

          -- Combine the results from ancestors and descendants
          SELECT DISTINCT
              id,
              identifier,
              workspace_id,
              kind,
              version,
              name,
              level,
              parent_identifier,
              parent_workspace_id
          FROM
              (
                  SELECT * FROM ancestors
                  UNION ALL
                  SELECT * FROM descendants
              ) AS combined;
        `,
      );
      return results.rows;
    }),
});

type _StringStringRecord = Record<string, string>;
const targetQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select({
      target: target,
      targetProvider: targetProvider,
      workspace: workspace,
      targetMetadata:
        sql<_StringStringRecord>`jsonb_object_agg(target_metadata.key,
       target_metadata.value)`.as("target_metadata"),
    })
    .from(target)
    .leftJoin(targetProvider, eq(target.providerId, targetProvider.id))
    .innerJoin(workspace, eq(target.workspaceId, workspace.id))
    .leftJoin(targetMetadata, eq(targetMetadata.targetId, target.id))
    .where(and(...checks))
    .groupBy(target.id, targetProvider.id, workspace.id)
    .orderBy(asc(target.kind), asc(target.name));

export const targetRouter = createTRPCRouter({
  metadataGroup: targetMetadataGroupRouter,
  provider: targetProviderRouter,
  relations: targetRelations,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.TargetGet).on({ type: "target", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const metadata = await ctx.db
        .select()
        .from(targetMetadata)
        .where(eq(targetMetadata.targetId, input))
        .then((lbs) => Object.fromEntries(lbs.map((lb) => [lb.key, lb.value])));
      return ctx.db
        .select()
        .from(target)
        .leftJoin(targetProvider, eq(target.providerId, targetProvider.id))
        .where(eq(target.id, input))
        .then(takeFirstOrNull)
        .then((a) =>
          a == null
            ? null
            : { ...a.target, metadata, provider: a.target_provider },
        );
    }),

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
          limit: z.number().default(500),
          offset: z.number().default(0),
        }),
      )
      .query(({ ctx, input }) => {
        const workspaceIdCheck = eq(target.workspaceId, input.workspaceId);
        const targetConditions = targetMatchesMetadata(ctx.db, input.filter);
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
          .from(target)
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
    .input(createTarget.and(z.object({ metadata: z.record(z.string()) })))
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const tg = await tx
          .insert(target)
          .values(input)
          .returning()
          .then(takeFirst);

        await tx.insert(targetMetadata).values(
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
          ...(input as string[]).map((t) => ({
            type: "target" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .mutation(async ({ ctx, input }) =>
      ctx.db.delete(target).where(inArray(target.id, input)).returning(),
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
        .selectDistinct({ key: targetMetadata.key })
        .from(target)
        .innerJoin(targetMetadata, eq(targetMetadata.targetId, target.id))
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
