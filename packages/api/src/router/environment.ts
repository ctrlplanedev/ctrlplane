import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  not,
  takeFirst,
} from "@ctrlplane/db";
import {
  createEnvironment,
  environment,
  environmentMetadata,
  environmentPolicy,
  environmentPolicyReleaseChannel,
  environmentPolicyReleaseWindow,
  environmentReleaseChannel,
  releaseChannel,
  resource,
  resourceMatchesMetadata,
  system,
  updateEnvironment,
} from "@ctrlplane/db/schema";
import {
  dispatchJobsForAddedResources,
  getEventsForEnvironmentDeleted,
  handleEnvironmentReleaseChannelUpdate,
  handleEvent,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { policyRouter } from "./environment-policy";

export const createEnv = async (
  db: Tx,
  input: z.infer<typeof createEnvironment>,
) => db.insert(environment).values(input).returning().then(takeFirst);

export const environmentRouter = createTRPCRouter({
  policy: policyRouter,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const envRCSubquery = ctx.db
        .select({
          releaseChannelEnvId: environmentReleaseChannel.environmentId,
          releaseChannelDeploymentId: releaseChannel.deploymentId,
          releaseChannelDescription: releaseChannel.description,
          releaseChannelFilter: releaseChannel.releaseFilter,
          releaseChannelId: releaseChannel.id,
          releaseChannelName: releaseChannel.name,
        })
        .from(environmentReleaseChannel)
        .innerJoin(
          releaseChannel,
          eq(environmentReleaseChannel.channelId, releaseChannel.id),
        )
        .as("envRCSubquery");

      const policyRCSubquery = ctx.db
        .select({
          releaseChannelPolicyId: environmentPolicyReleaseChannel.policyId,
          releaseChannelDeploymentId: releaseChannel.deploymentId,
          releaseChannelDescription: releaseChannel.description,
          releaseChannelFilter: releaseChannel.releaseFilter,
          releaseChannelId: releaseChannel.id,
          releaseChannelName: releaseChannel.name,
        })
        .from(environmentPolicyReleaseChannel)
        .innerJoin(
          releaseChannel,
          eq(environmentPolicyReleaseChannel.channelId, releaseChannel.id),
        )
        .as("policyRCSubquery");

      return ctx.db
        .select()
        .from(environment)
        .leftJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .innerJoin(system, eq(environment.systemId, system.id))
        .leftJoin(
          envRCSubquery,
          eq(environment.id, envRCSubquery.releaseChannelEnvId),
        )
        .leftJoin(
          policyRCSubquery,
          eq(environmentPolicy.id, policyRCSubquery.releaseChannelPolicyId),
        )
        .leftJoin(
          environmentMetadata,
          eq(environmentMetadata.environmentId, environment.id),
        )
        .where(eq(environment.id, input))
        .then((rows) => {
          const env = rows.at(0);
          if (env == null) return null;

          if (env.environment_policy == null)
            throw new Error(
              "No policy found on environment, this should never happen. Please contact support.",
            );

          const policy = {
            ...env.environment_policy,
            releaseChannels: _.chain(rows)
              .map((r) => r.policyRCSubquery)
              .filter(isPresent)
              .uniqBy((r) => r.releaseChannelId)
              .map((r) => ({
                deploymentId: r.releaseChannelDeploymentId,
                description: r.releaseChannelDescription,
                releaseFilter: r.releaseChannelFilter,
                id: r.releaseChannelId,
                name: r.releaseChannelName,
              }))
              .value(),
            releaseWindows: _.chain(rows)
              .map((r) => r.environment_policy_release_window)
              .filter(isPresent)
              .uniqBy((r) => r.id)
              .value(),
            isOverride:
              env.environment_policy.environmentId === env.environment.id,
          };

          const releaseChannels = _.chain(rows)
            .map((r) => r.envRCSubquery)
            .filter(isPresent)
            .uniqBy((r) => r.releaseChannelId)
            .map((r) => ({
              deploymentId: r.releaseChannelDeploymentId,
              releaseFilter: r.releaseChannelFilter,
              description: r.releaseChannelDescription,
              id: r.releaseChannelId,
              name: r.releaseChannelName,
            }))
            .value();

          const metadata = _.chain(rows)
            .map((r) => r.environment_metadata)
            .filter(isPresent)
            .uniqBy((r) => r.key)
            .keyBy((r) => r.key)
            .mapValues((r) => r.value)
            .value();

          return {
            ...env.environment,
            policy,
            releaseChannels,
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
      ctx.db.transaction((db) => createEnv(db, input)),
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
        .set(input.data)
        .where(eq(environment.id, input.id))
        .returning()
        .then(takeFirst);

      const { resourceFilter } = input.data;
      const isUpdatingResourceFilter =
        resourceFilter != null || oldEnv.environment.resourceFilter != null;
      if (isUpdatingResourceFilter) {
        const hasResourceFiltersChanged = !_.isEqual(
          oldEnv.environment.resourceFilter,
          resourceFilter,
        );

        if (hasResourceFiltersChanged) {
          const isOtherEnv = and(
            isNotNull(environment.resourceFilter),
            ne(environment.id, input.id),
          );
          const sys = await ctx.db.query.system.findFirst({
            where: eq(system.id, oldEnv.system.id),
            with: { environments: { where: isOtherEnv }, deployments: true },
          });

          const otherEnvFilters =
            sys?.environments.map((e) => e.resourceFilter).filter(isPresent) ??
            [];

          const oldQuery = resourceMatchesMetadata(
            ctx.db,
            oldEnv.environment.resourceFilter,
          );
          const newQuery = resourceMatchesMetadata(ctx.db, resourceFilter);

          const newResources =
            newQuery != null
              ? await ctx.db
                  .select({ id: resource.id })
                  .from(resource)
                  .where(
                    and(
                      eq(resource.workspaceId, oldEnv.system.workspaceId),
                      isNull(resource.deletedAt),
                      newQuery,
                      oldQuery && not(oldQuery),
                    ),
                  )
              : [];

          const removedResources =
            oldQuery != null
              ? await ctx.db.query.resource.findMany({
                  where: and(
                    eq(resource.workspaceId, oldEnv.system.workspaceId),
                    isNull(resource.deletedAt),
                    oldQuery,
                    newQuery && not(newQuery),
                  ),
                })
              : [];

          if (removedResources.length > 0) {
            const sysFilter: ResourceCondition = {
              type: FilterType.Comparison,
              operator: ComparisonOperator.Or,
              not: true,
              conditions: otherEnvFilters,
            };

            const isRemovedFromEnv = inArray(
              resource.id,
              removedResources.map((r) => r.id),
            );

            const isRemovedFromSystem =
              otherEnvFilters.length > 0
                ? resourceMatchesMetadata(ctx.db, sysFilter)
                : undefined;
            const isNotDeleted = isNull(resource.deletedAt);

            const removedFromSystemResources =
              await ctx.db.query.resource.findMany({
                where: and(isRemovedFromEnv, isRemovedFromSystem, isNotDeleted),
              });

            const events = removedFromSystemResources.flatMap((resource) =>
              (sys?.deployments ?? []).map((deployment) => ({
                action: "deployment.resource.removed" as const,
                payload: { deployment, resource },
              })),
            );

            const handleEventPromises = events.map(handleEvent);
            await Promise.allSettled(handleEventPromises);
          }

          if (newResources.length > 0) {
            await dispatchJobsForAddedResources(
              ctx.db,
              newResources.map((r) => r.id),
              input.id,
            );
            console.log(
              `Found ${newResources.length} new resources for environment ${input.id}`,
            );
          }
        }
      }

      return updatedEnv;
    }),

  updateReleaseChannels: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        releaseChannels: z.record(z.string().uuid().nullable()),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentUpdate)
          .on({ type: "environment", id: input.id }),
    })
    .mutation(async ({ ctx, input }) => {
      const prevReleaseChannels = await ctx.db
        .select({
          deploymentId: environmentReleaseChannel.deploymentId,
          channelId: environmentReleaseChannel.channelId,
        })
        .from(environmentReleaseChannel)
        .where(eq(environmentReleaseChannel.environmentId, input.id));

      const [nulled, set] = _.partition(
        Object.entries(input.releaseChannels),
        ([_, channelId]) => channelId == null,
      );

      const nulledIds = nulled.map(([deploymentId]) => deploymentId);
      const setChannels = set.map(([deploymentId, channelId]) => ({
        environmentId: input.id,
        deploymentId,
        channelId: channelId!,
      }));

      await ctx.db.transaction(async (db) => {
        await db
          .delete(environmentReleaseChannel)
          .where(
            and(
              eq(environmentReleaseChannel.environmentId, input.id),
              inArray(environmentReleaseChannel.deploymentId, nulledIds),
            ),
          );

        if (setChannels.length > 0)
          await db
            .insert(environmentReleaseChannel)
            .values(setChannels)
            .onConflictDoUpdate({
              target: [
                environmentReleaseChannel.environmentId,
                environmentReleaseChannel.deploymentId,
              ],
              set: buildConflictUpdateColumns(environmentReleaseChannel, [
                "channelId",
              ]),
            });
      });

      const newReleaseChannels = await ctx.db
        .select({
          deploymentId: environmentReleaseChannel.deploymentId,
          channelId: environmentReleaseChannel.channelId,
        })
        .from(environmentReleaseChannel)
        .where(eq(environmentReleaseChannel.environmentId, input.id));

      const prevMap = Object.fromEntries(
        prevReleaseChannels.map((r) => [r.deploymentId, r.channelId]),
      );
      const newMap = Object.fromEntries(
        newReleaseChannels.map((r) => [r.deploymentId, r.channelId]),
      );

      await handleEnvironmentReleaseChannelUpdate(input.id, prevMap, newMap);
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
        .delete(environment)
        .where(eq(environment.id, input))
        .returning()
        .then(takeFirst)
        .then(async (env) => {
          const events = await getEventsForEnvironmentDeleted(env);
          const handleEventPromises = events.map(handleEvent);
          await Promise.allSettled(handleEventPromises);
          return env;
        }),
    ),
});
