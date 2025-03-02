import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  count,
  createEnv,
  eq,
  ilike,
  isNotNull,
  isNull,
  or,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createSystem,
  deployment,
  environment,
  resource,
  resourceMatchesMetadata,
  system,
  updateSystem,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const systemRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(
      z.object({
        workspaceId: z.string().uuid(),
        query: z.string().optional(),
        limit: z.number().default(500),
        offset: z.number().default(0),
      }),
    )
    .query(({ ctx, input }) => {
      const workspaceIdCheck = eq(system.workspaceId, input.workspaceId);

      const query = input.query
        ? or(
            ilike(system.name, `%${input.query}%`),
            ilike(system.slug, `%${input.query}%`),
            ilike(deployment.name, `%${input.query}%`),
            ilike(deployment.slug, `%${input.query}%`),
          )
        : undefined;
      const checks = and(workspaceIdCheck, query);

      const items = ctx.db
        .select()
        .from(system)
        .leftJoin(environment, eq(environment.systemId, system.id))
        .leftJoin(deployment, eq(deployment.systemId, system.id))
        .where(checks)
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(asc(system.name))
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.system.id)
            .map((r) => ({
              ...r[0]!.system,
              environments: _.chain(r)
                .map((r) => r.environment)
                .filter(isPresent)
                .uniqBy((e) => e.id)
                .value(),
              deployments: _.chain(r)
                .map((r) => r.deployment)
                .filter(isPresent)
                .uniqBy((d) => d.id)
                .value(),
            }))
            .value(),
        );

      const total = ctx.db
        .select({ count: count().as("total") })
        .from(system)
        .where(eq(system.workspaceId, input.workspaceId))
        .then(takeFirst)
        .then((total) => total.count);

      return Promise.all([items, total]).then(([items, total]) => ({
        items,
        total,
      }));
    }),

  bySlug: protectedProcedure
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const sys = await ctx.db
          .select()
          .from(system)
          .innerJoin(workspace, eq(system.workspaceId, workspace.id))
          .where(
            and(
              eq(system.slug, input.systemSlug),
              eq(workspace.slug, input.workspaceSlug),
            ),
          )
          .then(takeFirst);
        return canUser
          .perform(Permission.SystemGet)
          .on({ type: "system", id: sys.system.id });
      },
    })
    .input(z.object({ workspaceSlug: z.string(), systemSlug: z.string() }))
    .query(({ ctx: { db }, input }) =>
      db
        .select()
        .from(system)
        .innerJoin(workspace, eq(system.workspaceId, workspace.id))
        .leftJoin(environment, eq(environment.systemId, system.id))
        .where(
          and(
            eq(system.slug, input.systemSlug),
            eq(workspace.slug, input.workspaceSlug),
          ),
        )
        .then((rows) => ({
          ...rows[0]!.system,
          environments: rows.map((r) => r.environment).filter(isPresent),
        })),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx: { db }, input }) =>
      db
        .select()
        .from(system)
        .innerJoin(workspace, eq(system.workspaceId, workspace.id))
        .leftJoin(environment, eq(environment.systemId, system.id))
        .where(eq(system.id, input))
        .then((rows) => ({
          ...rows[0]!.system,
          environments: rows.map((r) => r.environment).filter(isPresent),
        })),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createSystem)
    .mutation(({ ctx: { db }, input }) =>
      db.transaction(async (db) => {
        const sys = await db
          .insert(system)
          .values(input)
          .returning()
          .then(takeFirst);

        await Promise.all([
          createEnv(db, { systemId: sys.id, name: "Production" }),
          createEnv(db, { systemId: sys.id, name: "QA" }),
          createEnv(db, { systemId: sys.id, name: "Staging" }),
        ]);
        return sys;
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "system", id: input.id }),
    })
    .input(z.object({ id: z.string(), data: updateSystem }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(system)
        .set(input.data)
        .where(eq(system.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemDelete)
          .on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(system)
        .where(eq(system.id, input))
        .returning()
        .then(takeFirst),
    ),

  resources: protectedProcedure
    .input(
      z.object({
        systemId: z.string().uuid(),
        limit: z.number().int().nonnegative().max(1000).default(200),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "system", id: input.systemId }),
    })
    .query(async ({ ctx, input }) => {
      const sys = await ctx.db
        .select()
        .from(system)
        .where(eq(system.id, input.systemId))
        .then(takeFirstOrNull);

      if (!sys) throw new Error("System not found");

      const envsWithFilter = await ctx.db
        .select()
        .from(environment)
        .where(
          and(
            eq(environment.systemId, input.systemId),
            isNotNull(environment.resourceFilter),
          ),
        );

      const filter: ResourceCondition = {
        type: FilterType.Comparison,
        operator: ComparisonOperator.Or,
        conditions: envsWithFilter.map((env) => env.resourceFilter!),
      };

      const itemsPromise = ctx.db
        .select()
        .from(resource)
        .where(
          and(
            eq(resource.workspaceId, sys.workspaceId),
            resourceMatchesMetadata(ctx.db, filter),
            isNull(resource.deletedAt),
          ),
        )
        .limit(input.limit)
        .offset(input.offset)
        .orderBy(asc(resource.name));

      const totalPromise = ctx.db
        .select({ count: count().as("total") })
        .from(resource)
        .where(
          and(
            eq(resource.workspaceId, sys.workspaceId),
            resourceMatchesMetadata(ctx.db, filter),
            isNull(resource.deletedAt),
          ),
        )
        .then(takeFirst)
        .then((total) => total.count);

      return Promise.all([itemsPromise, totalPromise]).then(
        ([items, total]) => ({
          items,
          total,
        }),
      );
    }),
});
