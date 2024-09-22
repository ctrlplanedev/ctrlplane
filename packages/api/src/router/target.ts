import type { SQL, Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  eq,
  inArray,
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
import { comparisonCondition } from "@ctrlplane/validators/targets";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { targetMetadataGroupRouter } from "./target-metadata-group";
import { targetProviderRouter } from "./target-provider";

const targetQuery = (db: Tx, checks: Array<SQL<unknown>>) =>
  db
    .select({
      target: target,
      targetProvider: targetProvider,
      workspace: workspace,
      targetMetadata: sql<
        Record<string, string>
      >`jsonb_object_agg(target_metadata.key,
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
          filters: z.array(comparisonCondition).optional(),
          limit: z.number().default(500),
          offset: z.number().default(0),
        }),
      )
      .query(({ ctx, input }) => {
        const workspaceIdCheck = eq(target.workspaceId, input.workspaceId);

        const targetConditions = targetMatchesMetadata(ctx.db, {
          operator: "and",
          type: "comparison",
          conditions: input.filters ?? [],
        });

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
