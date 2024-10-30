import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNull,
  not,
  takeFirst,
} from "@ctrlplane/db";
import {
  createEnvironment,
  environment,
  environmentPolicy,
  environmentPolicyReleaseChannel,
  environmentReleaseChannel,
  releaseChannel,
  system,
  target,
  targetMatchesMetadata,
  updateEnvironment,
} from "@ctrlplane/db/schema";
import { dispatchJobsForNewTargets } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { policyRouter } from "./environment-policy";

export const createEnv = async (
  db: Tx,
  input: z.infer<typeof createEnvironment>,
) => {
  return db.insert(environment).values(input).returning().then(takeFirst);
};

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
        .innerJoin(system, eq(environment.systemId, system.id))
        .leftJoin(
          envRCSubquery,
          eq(environment.id, envRCSubquery.releaseChannelEnvId),
        )
        .leftJoin(
          policyRCSubquery,
          eq(environmentPolicy.id, policyRCSubquery.releaseChannelPolicyId),
        )
        .where(eq(environment.id, input))
        .then((rows) => {
          const env = rows.at(0);
          if (env == null) return null;
          const policy =
            env.environment_policy == null
              ? null
              : {
                  ...env.environment_policy,
                  releaseChannels: _.chain(rows)
                    .map((r) => r.policyRCSubquery)
                    .filter(isPresent)
                    .uniqBy((r) => r.releaseChannelId)
                    .map((r) => ({
                      deploymentId: r.releaseChannelDeploymentId,
                      filter: r.releaseChannelFilter,
                      id: r.releaseChannelId,
                      name: r.releaseChannelName,
                    }))
                    .value(),
                };

          const releaseChannels = _.chain(rows)
            .map((r) => r.envRCSubquery)
            .filter(isPresent)
            .uniqBy((r) => r.releaseChannelId)
            .map((r) => ({
              deploymentId: r.releaseChannelDeploymentId,
              filter: r.releaseChannelFilter,
              id: r.releaseChannelId,
              name: r.releaseChannelName,
            }))
            .value();

          return {
            ...env.environment,
            policy,
            releaseChannels,
            system: env.system,
          };
        });
    }),

  bySystemId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.SystemGet).on({ type: "system", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const envs = await ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(system.id, environment.systemId))
        .orderBy(environment.name)
        .where(
          and(eq(environment.systemId, input), isNull(environment.deletedAt)),
        );

      return await Promise.all(
        envs.map(async (e) => ({
          ...e.environment,
          system: e.system,
          targets:
            e.environment.targetFilter != null
              ? await ctx.db
                  .select()
                  .from(target)
                  .where(
                    targetMatchesMetadata(ctx.db, e.environment.targetFilter),
                  )
              : [],
        })),
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

      const { targetFilter } = input.data;
      const isUpdatingTargetFilter = targetFilter != null;
      if (isUpdatingTargetFilter) {
        const hasTargetFiltersChanged = !_.isEqual(
          oldEnv.environment.targetFilter,
          targetFilter,
        );

        if (hasTargetFiltersChanged) {
          const oldQuery = targetMatchesMetadata(
            ctx.db,
            oldEnv.environment.targetFilter,
          );
          const newTargets = await ctx.db
            .select({ id: target.id })
            .from(target)
            .where(
              and(
                eq(target.workspaceId, oldEnv.system.workspaceId),
                targetMatchesMetadata(ctx.db, targetFilter),
                oldQuery && not(oldQuery),
              ),
            );

          if (newTargets.length > 0) {
            await dispatchJobsForNewTargets(
              ctx.db,
              newTargets.map((t) => t.id),
              input.id,
            );
            console.log(
              `Found ${newTargets.length} new targets for environment ${input.id}`,
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
    .mutation(({ ctx, input }) => {
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

      return ctx.db.transaction(async (db) => {
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
      ctx.db.transaction((db) =>
        db
          .delete(environment)
          .where(eq(environment.id, input))
          .returning()
          .then(takeFirst),
      ),
    ),
});
