import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  isNotNull,
  isNull,
  lte,
  sql,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";

import { protectedProcedure, router } from "../trpc.js";

export const reconcileRouter = router({
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        kind: z.string().min(1),
        scopeType: z.string().default(""),
        scopeId: z.string().default(""),
        priority: z.number().int().min(0).max(32767).default(100),
        notBefore: z.coerce.date().optional(),
        payload: z
          .object({
            payloadType: z.string().default(""),
            payloadKey: z.string().default(""),
            payload: z.record(z.string(), z.any()).default({}),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [scope] = await ctx.db
        .insert(schema.reconcileWorkScope)
        .values({
          workspaceId: input.workspaceId,
          kind: input.kind,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          priority: input.priority,
          notBefore: input.notBefore ?? new Date(),
        })
        .onConflictDoUpdate({
          target: [
            schema.reconcileWorkScope.workspaceId,
            schema.reconcileWorkScope.kind,
            schema.reconcileWorkScope.scopeType,
            schema.reconcileWorkScope.scopeId,
          ],
          set: {
            eventTs: new Date(),
            priority: input.priority,
            notBefore: input.notBefore ?? new Date(),
          },
        })
        .returning();

      if (input.payload && scope) {
        await ctx.db
          .insert(schema.reconcileWorkPayload)
          .values({
            scopeRef: scope.id,
            payloadType: input.payload.payloadType,
            payloadKey: input.payload.payloadKey,
            payload: input.payload.payload,
          })
          .onConflictDoUpdate({
            target: [
              schema.reconcileWorkPayload.scopeRef,
              schema.reconcileWorkPayload.payloadType,
              schema.reconcileWorkPayload.payloadKey,
            ],
            set: {
              payload: input.payload.payload,
            },
          });
      }

      return scope;
    }),

  listWorkScopes: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        kind: z.string().optional(),
        claimed: z.enum(["all", "claimed", "unclaimed"]).default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(schema.reconcileWorkScope.workspaceId, input.workspaceId),
      ];

      if (input.kind) {
        conditions.push(eq(schema.reconcileWorkScope.kind, input.kind));
      }

      if (input.claimed === "claimed") {
        conditions.push(isNotNull(schema.reconcileWorkScope.claimedBy));
      } else if (input.claimed === "unclaimed") {
        conditions.push(isNull(schema.reconcileWorkScope.claimedBy));
      }

      const [items, [total]] = await Promise.all([
        ctx.db
          .select()
          .from(schema.reconcileWorkScope)
          .where(and(...conditions))
          .orderBy(
            schema.reconcileWorkScope.priority,
            desc(schema.reconcileWorkScope.eventTs),
          )
          .limit(input.limit)
          .offset(input.offset),

        ctx.db
          .select({ count: count() })
          .from(schema.reconcileWorkScope)
          .where(and(...conditions)),
      ]);

      return { items, total: total?.count ?? 0 };
    }),

  listWorkPayloads: protectedProcedure
    .input(
      z.object({
        scopeId: z.number(),
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
      }),
    )
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .select()
        .from(schema.reconcileWorkPayload)
        .where(eq(schema.reconcileWorkPayload.scopeRef, input.scopeId))
        .orderBy(desc(schema.reconcileWorkPayload.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return items;
    }),

  stats: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();

      const [totalResult, claimedResult, pendingResult, kindResults] =
        await Promise.all([
          ctx.db
            .select({ count: count() })
            .from(schema.reconcileWorkScope)
            .where(
              eq(schema.reconcileWorkScope.workspaceId, input.workspaceId),
            ),

          ctx.db
            .select({ count: count() })
            .from(schema.reconcileWorkScope)
            .where(
              and(
                eq(schema.reconcileWorkScope.workspaceId, input.workspaceId),
                isNotNull(schema.reconcileWorkScope.claimedBy),
              ),
            ),

          ctx.db
            .select({ count: count() })
            .from(schema.reconcileWorkScope)
            .where(
              and(
                eq(schema.reconcileWorkScope.workspaceId, input.workspaceId),
                isNull(schema.reconcileWorkScope.claimedBy),
                lte(schema.reconcileWorkScope.notBefore, now),
              ),
            ),

          ctx.db
            .select({
              kind: schema.reconcileWorkScope.kind,
              count: count(),
            })
            .from(schema.reconcileWorkScope)
            .where(eq(schema.reconcileWorkScope.workspaceId, input.workspaceId))
            .groupBy(schema.reconcileWorkScope.kind),
        ]);

      return {
        total: totalResult[0]?.count ?? 0,
        claimed: claimedResult[0]?.count ?? 0,
        pending: pendingResult[0]?.count ?? 0,
        byKind: kindResults,
      };
    }),

  chartData: protectedProcedure
    .input(z.object({ workspaceId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const wsFilter = eq(
        schema.reconcileWorkScope.workspaceId,
        input.workspaceId,
      );

      const [
        byPriority,
        byClaimStatus,
        byKind,
        payloadErrors,
        payloadAttempts,
      ] = await Promise.all([
        ctx.db
          .select({
            priority: schema.reconcileWorkScope.priority,
            count: count(),
          })
          .from(schema.reconcileWorkScope)
          .where(wsFilter)
          .groupBy(schema.reconcileWorkScope.priority)
          .orderBy(schema.reconcileWorkScope.priority),

        ctx.db
          .select({
            status: sql<string>`
              CASE
                WHEN ${schema.reconcileWorkScope.claimedBy} IS NOT NULL
                     AND ${schema.reconcileWorkScope.claimedUntil} > ${now}
                  THEN 'claimed'
                WHEN ${schema.reconcileWorkScope.claimedBy} IS NOT NULL
                     AND ${schema.reconcileWorkScope.claimedUntil} <= ${now}
                  THEN 'expired'
                WHEN ${schema.reconcileWorkScope.claimedBy} IS NULL
                     AND ${schema.reconcileWorkScope.notBefore} <= ${now}
                  THEN 'pending'
                ELSE 'scheduled'
              END
            `.as("status"),
            count: count(),
          })
          .from(schema.reconcileWorkScope)
          .where(wsFilter)
          .groupBy(sql`status`),

        ctx.db
          .select({
            kind: schema.reconcileWorkScope.kind,
            count: count(),
          })
          .from(schema.reconcileWorkScope)
          .where(wsFilter)
          .groupBy(schema.reconcileWorkScope.kind),

        ctx.db
          .select({
            hasError:
              sql<boolean>`${schema.reconcileWorkPayload.lastError} IS NOT NULL`.as(
                "has_error",
              ),
            count: count(),
          })
          .from(schema.reconcileWorkPayload)
          .innerJoin(
            schema.reconcileWorkScope,
            eq(
              schema.reconcileWorkPayload.scopeRef,
              schema.reconcileWorkScope.id,
            ),
          )
          .where(wsFilter)
          .groupBy(sql`has_error`),

        ctx.db
          .select({
            bucket: sql<string>`
              CASE
                WHEN ${schema.reconcileWorkPayload.attemptCount} = 0 THEN '0'
                WHEN ${schema.reconcileWorkPayload.attemptCount} = 1 THEN '1'
                WHEN ${schema.reconcileWorkPayload.attemptCount} BETWEEN 2 AND 5 THEN '2-5'
                ELSE '6+'
              END
            `.as("bucket"),
            count: count(),
          })
          .from(schema.reconcileWorkPayload)
          .innerJoin(
            schema.reconcileWorkScope,
            eq(
              schema.reconcileWorkPayload.scopeRef,
              schema.reconcileWorkScope.id,
            ),
          )
          .where(wsFilter)
          .groupBy(sql`bucket`),
      ]);

      return {
        byPriority,
        byClaimStatus,
        byKind,
        payloadErrors,
        payloadAttempts,
      };
    }),
});
