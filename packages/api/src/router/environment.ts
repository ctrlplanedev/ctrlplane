import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  createEnv,
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
  deploymentVersionChannel,
  environment,
  environmentMetadata,
  environmentPolicy,
  environmentPolicyDeploymentVersionChannel,
  environmentPolicyReleaseWindow,
  resource,
  resourceMatchesMetadata,
  system,
  updateEnvironment,
} from "@ctrlplane/db/schema";
import {
  dispatchJobsForAddedResources,
  getEventsForEnvironmentDeleted,
  handleEvent,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { environmentPageRouter } from "./environment-page/router";
import { policyRouter } from "./environment-policy";
import { environmentStatsRouter } from "./environment-stats";

export const environmentRouter = createTRPCRouter({
  policy: policyRouter,
  stats: environmentStatsRouter,
  page: environmentPageRouter,

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "environment", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const policyRCSubquery = ctx.db
        .select({
          deploymentVersionChannelPolicyId:
            environmentPolicyDeploymentVersionChannel.policyId,
          deploymentVersionChannelDeploymentId:
            environmentPolicyDeploymentVersionChannel.deploymentId,
          deploymentVersionChannelDescription:
            deploymentVersionChannel.description,
          deploymentVersionChannelSelector:
            deploymentVersionChannel.versionSelector,
          deploymentVersionChannelId: deploymentVersionChannel.id,
          deploymentVersionChannelName: deploymentVersionChannel.name,
        })
        .from(environmentPolicyDeploymentVersionChannel)
        .innerJoin(
          deploymentVersionChannel,
          eq(
            environmentPolicyDeploymentVersionChannel.channelId,
            deploymentVersionChannel.id,
          ),
        )
        .as("policyRCSubquery");

      return ctx.db
        .select()
        .from(environment)
        .innerJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .innerJoin(system, eq(environment.systemId, system.id))
        .leftJoin(
          policyRCSubquery,
          eq(
            environmentPolicy.id,
            policyRCSubquery.deploymentVersionChannelPolicyId,
          ),
        )
        .leftJoin(
          environmentMetadata,
          eq(environmentMetadata.environmentId, environment.id),
        )
        .where(eq(environment.id, input))
        .then((rows) => {
          const env = rows.at(0);
          if (env == null) return null;

          const policy = {
            ...env.environment_policy,
            versionChannels: _.chain(rows)
              .map((r) => r.policyRCSubquery)
              .filter(isPresent)
              .uniqBy((r) => r.deploymentVersionChannelId)
              .map((r) => ({
                deploymentId: r.deploymentVersionChannelDeploymentId,
                description: r.deploymentVersionChannelDescription,
                versionSelector: r.deploymentVersionChannelSelector,
                id: r.deploymentVersionChannelId,
                name: r.deploymentVersionChannelName,
              }))
              .value(),
            releaseWindows: _.chain(rows)
              .map((r) => r.environment_policy_release_window)
              .filter(isPresent)
              .uniqBy((r) => r.id)
              .value(),
            isDefaultPolicy:
              env.environment_policy.environmentId === env.environment.id,
          };

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

      const overridePolicy = await ctx.db
        .select()
        .from(environmentPolicy)
        .where(eq(environmentPolicy.environmentId, input.id))
        .then(takeFirst);

      const getPolicyId = () => {
        if (input.data.policyId != null) return input.data.policyId;
        if (input.data.policyId === null) return overridePolicy.id;
        return oldEnv.environment.policyId;
      };

      const policyId = getPolicyId();

      const updatedEnv = await ctx.db
        .update(environment)
        .set({ ...input.data, policyId })
        .where(eq(environment.id, input.id))
        .returning()
        .then(takeFirst);

      const { resourceSelector } = input.data;
      const isUpdatingResourceSelector =
        resourceSelector != null || oldEnv.environment.resourceSelector != null;
      if (isUpdatingResourceSelector) {
        const hasResourceSelectorsChanged = !_.isEqual(
          oldEnv.environment.resourceSelector,
          resourceSelector,
        );

        if (hasResourceSelectorsChanged) {
          const isOtherEnv = and(
            isNotNull(environment.resourceSelector),
            ne(environment.id, input.id),
          );
          const sys = await ctx.db.query.system.findFirst({
            where: eq(system.id, oldEnv.system.id),
            with: { environments: { where: isOtherEnv }, deployments: true },
          });

          const otherEnvFilters =
            sys?.environments
              .map((e) => e.resourceSelector)
              .filter(isPresent) ?? [];

          const oldQuery = resourceMatchesMetadata(
            ctx.db,
            oldEnv.environment.resourceSelector,
          );
          const newQuery = resourceMatchesMetadata(ctx.db, resourceSelector);

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
              type: ConditionType.Comparison,
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
