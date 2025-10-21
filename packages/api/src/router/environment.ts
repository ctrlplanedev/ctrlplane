import _ from "lodash-es";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, count, eq, ilike, takeFirst, upsertEnv } from "@ctrlplane/db";
import {
  createEnvironment,
  environment,
  environmentMetadata,
  system,
  updateEnvironment,
} from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { getWorkspaceEngineClient } from "../workspace-engine-client";
import { environmentPageRouter } from "./environment-page/router";
import { environmentStatsRouter } from "./environment-stats";
import { versionPinningRouter } from "./version-pinning";

export const environmentRouter = createTRPCRouter({
  stats: environmentStatsRouter,
  page: environmentPageRouter,
  versionPinning: versionPinningRouter,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(environment.systemId, system.id))
        .leftJoin(
          environmentMetadata,
          eq(environmentMetadata.environmentId, environment.id),
        )
        .where(eq(environment.id, input))
        .then((rows) => {
          const env = rows.at(0);
          if (env == null) return null;

          const metadata = _.chain(rows)
            .map((r) => r.environment_metadata)
            .filter(isPresent)
            .uniqBy((r) => r.key)
            .keyBy((r) => r.key)
            .mapValues((r) => r.value)
            .value();

          return {
            ...env.environment,
            system: env.system,
            metadata,
          };
        });
    }),

  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(system.id, environment.systemId))
        .leftJoin(
          environmentMetadata,
          eq(environmentMetadata.environmentId, environment.id),
        )
        .orderBy(environment.name)
        .where(eq(environment.systemId, input))
        .then((envs) =>
          _.chain(envs)
            .groupBy((e) => e.environment.id)
            .map((groupedRows) => {
              const env = groupedRows.at(0)!;
              const { system } = env;
              const metadata = _.chain(groupedRows)
                .map((r) => r.environment_metadata)
                .filter(isPresent)
                .uniqBy((r) => r.key)
                .keyBy((r) => r.key)
                .mapValues((r) => r.value)
                .value();
              return { ...env.environment, system, metadata };
            })
            .value(),
        ),
    ),

  bySystemIdWithSearch: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "system", id: input.systemId }),
    })
    .input(
      z.object({
        systemId: z.string().uuid(),
        query: z.string().default(""),
        limit: z.number().default(500),
        offset: z.number().default(0),
      }),
    )
    .query(({ ctx, input }) => {
      const itemsPromise = ctx.db
        .select()
        .from(environment)
        .where(
          and(
            input.query != ""
              ? ilike(environment.name, `%${input.query}%`)
              : undefined,
            eq(environment.systemId, input.systemId),
          ),
        )
        .orderBy(environment.name)
        .limit(input.limit)
        .offset(input.offset);

      const countPromise = ctx.db
        .select({ count: count() })
        .from(environment)
        .where(
          and(
            input.query != ""
              ? ilike(environment.name, `%${input.query}%`)
              : undefined,
            eq(environment.systemId, input.systemId),
          ),
        )
        .then(takeFirst);

      return Promise.all([itemsPromise, countPromise]).then(
        ([items, { count }]) => ({
          items,
          count,
        }),
      );
    }),

  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(environment.systemId, system.id))
        .where(eq(system.workspaceId, input))
        .orderBy(environment.name)
        .then((envs) =>
          envs.map((e) => ({ ...e.environment, system: e.system })),
        ),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemCreate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(createEnvironment)
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (db) => {
        const env = await upsertEnv(db, input);
        await eventDispatcher.dispatchEnvironmentCreated(env);
        return env;
      }),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environment", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateEnvironment }))
    .mutation(async ({ ctx, input }) => {
      const oldEnv = await ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(system.id, environment.systemId))
        .where(eq(environment.id, input.id))
        .then(takeFirst);

      const updatedEnv = await ctx.db
        .update(environment)
        .set({ ...input.data })
        .where(eq(environment.id, input.id))
        .returning()
        .then(takeFirst);

      await eventDispatcher.dispatchEnvironmentUpdated(
        oldEnv.environment,
        updatedEnv,
      );

      return updatedEnv;
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemDelete)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .select()
        .from(environment)
        .where(eq(environment.id, input))
        .then(takeFirst)
        .then((env) => {
          eventDispatcher.dispatchEnvironmentDeleted(env);
          return env;
        }),
    ),

  resources: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const workspaceId = await ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(environment.systemId, system.id))
        .where(eq(environment.id, input))
        .then(takeFirst)
        .then((row) => row.system.workspaceId);

      const client = getWorkspaceEngineClient();
      const resp = await client.GET(
        "/v1/workspaces/{workspaceId}/environments/{environmentId}/resources",
        {
          params: {
            path: {
              workspaceId,
              environmentId: input,
            },
          },
        },
      );

      return resp.data?.resources ?? [];
    }),
});
