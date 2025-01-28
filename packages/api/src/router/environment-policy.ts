import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import {
  createEnvironmentPolicy,
  createEnvironmentPolicyDeployment,
  environment,
  environmentPolicy,
  environmentPolicyDeployment,
  environmentPolicyReleaseChannel,
  environmentPolicyReleaseWindow,
  releaseChannel,
  updateEnvironmentPolicy,
} from "@ctrlplane/db/schema";
import { handleEnvironmentPolicyReleaseChannelUpdate } from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { approvalRouter } from "./environment-approval";

export const policyRouter = createTRPCRouter({
  approval: approvalRouter,

  deployment: createTRPCRouter({
    bySystemId: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemGet)
            .on({ type: "system", id: input }),
      })
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .select()
          .from(environmentPolicyDeployment)
          .innerJoin(
            environmentPolicy,
            eq(environmentPolicy.id, environmentPolicyDeployment.policyId),
          )
          .where(eq(environmentPolicy.systemId, input))
          .then((d) => d.map((d) => d.environment_policy_deployment)),
      ),

    create: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemUpdate)
            .on({ type: "environment", id: input.environmentId }),
      })
      .input(createEnvironmentPolicyDeployment)
      .mutation(({ ctx, input }) =>
        ctx.db
          .insert(environmentPolicyDeployment)
          .values([input])
          .returning()
          .then(takeFirst),
      ),

    delete: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemUpdate)
            .on({ type: "environment", id: input.environmentId }),
      })
      .input(
        z.object({
          policyId: z.string().uuid(),
          environmentId: z.string().uuid(),
        }),
      )
      .mutation(({ ctx, input }) =>
        ctx.db
          .delete(environmentPolicyDeployment)
          .where(
            and(
              eq(environmentPolicyDeployment.policyId, input.policyId),
              eq(
                environmentPolicyDeployment.environmentId,
                input.environmentId,
              ),
            ),
          )
          .returning()
          .then(takeFirst),
      ),
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
        .from(environmentPolicy)
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .where(eq(environmentPolicy.systemId, input))
        .then((policies) =>
          _.chain(policies)
            .groupBy("environment_policy.id")
            .map((p) => ({
              ...p[0]!.environment_policy,
              releaseWindows: p
                .map((t) => t.environment_policy_release_window)
                .filter(isPresent),
            }))
            .value(),
        ),
    ),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemGet)
          .on({ type: "environmentPolicy", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) =>
      ctx.db
        .select()
        .from(environmentPolicy)
        .leftJoin(
          environmentPolicyReleaseChannel,
          eq(environmentPolicyReleaseChannel.policyId, environmentPolicy.id),
        )
        .leftJoin(
          releaseChannel,
          eq(environmentPolicyReleaseChannel.channelId, releaseChannel.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .leftJoin(environment, eq(environment.policyId, environmentPolicy.id))
        .where(eq(environmentPolicy.id, input))
        .then((rows) => {
          const policy = rows.at(0)!;
          const releaseChannels = _.chain(rows)
            .map((r) => r.release_channel)
            .filter(isPresent)
            .uniqBy((r) => r.id)
            .value();

          const releaseWindows = _.chain(rows)
            .map((r) => r.environment_policy_release_window)
            .filter(isPresent)
            .uniqBy((r) => r.id)
            .map((r) => ({
              ...r,
              startTime: new Date(r.startTime),
              endTime: new Date(r.endTime),
            }))
            .value();

          const environments = _.chain(rows)
            .map((r) => r.environment)
            .filter(isPresent)
            .uniqBy((e) => e.id)
            .value();

          return {
            ...policy.environment_policy,
            releaseChannels,
            releaseWindows,
            environments,
          };
        }),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(createEnvironmentPolicy)
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (db) =>
        db.insert(environmentPolicy).values(input).returning().then(takeFirst),
      ),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environmentPolicy", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateEnvironmentPolicy }))
    .mutation(async ({ ctx, input }) => {
      const { releaseChannels, releaseWindows, ...data } = input.data;
      const hasUpdates = Object.entries(data).length > 0;
      if (hasUpdates)
        await ctx.db
          .update(environmentPolicy)
          .set(data)
          .where(eq(environmentPolicy.id, input.id))
          .returning()
          .then(takeFirst);

      if (releaseChannels != null) {
        const prevReleaseChannels = await ctx.db
          .select({
            deploymentId: environmentPolicyReleaseChannel.deploymentId,
            channelId: environmentPolicyReleaseChannel.channelId,
          })
          .from(environmentPolicyReleaseChannel)
          .where(eq(environmentPolicyReleaseChannel.policyId, input.id));

        const [nulled, set] = _.partition(
          Object.entries(releaseChannels),
          ([_, channelId]) => channelId == null,
        );

        const nulledIds = nulled.map(([deploymentId]) => deploymentId);
        const setChannels = set.map(([deploymentId, channelId]) => ({
          policyId: input.id,
          deploymentId,
          channelId: channelId!,
        }));

        await ctx.db.transaction(async (db) => {
          if (nulledIds.length > 0)
            await db
              .delete(environmentPolicyReleaseChannel)
              .where(
                inArray(
                  environmentPolicyReleaseChannel.deploymentId,
                  nulledIds,
                ),
              );

          if (setChannels.length > 0)
            await db
              .insert(environmentPolicyReleaseChannel)
              .values(setChannels)
              .onConflictDoUpdate({
                target: [
                  environmentPolicyReleaseChannel.policyId,
                  environmentPolicyReleaseChannel.deploymentId,
                ],
                set: buildConflictUpdateColumns(
                  environmentPolicyReleaseChannel,
                  ["channelId"],
                ),
              });
        });

        const newReleaseChannels = await ctx.db
          .select({
            deploymentId: environmentPolicyReleaseChannel.deploymentId,
            channelId: environmentPolicyReleaseChannel.channelId,
          })
          .from(environmentPolicyReleaseChannel)
          .where(eq(environmentPolicyReleaseChannel.policyId, input.id));

        const prevMap = Object.fromEntries(
          prevReleaseChannels.map((r) => [r.deploymentId, r.channelId]),
        );
        const newMap = Object.fromEntries(
          newReleaseChannels.map((r) => [r.deploymentId, r.channelId]),
        );

        await handleEnvironmentPolicyReleaseChannelUpdate(
          input.id,
          prevMap,
          newMap,
        );
      }

      if (releaseWindows != null) {
        await ctx.db.transaction(async (db) => {
          await db
            .delete(environmentPolicyReleaseWindow)
            .where(eq(environmentPolicyReleaseWindow.policyId, input.id));
          if (releaseWindows.length > 0)
            await db
              .insert(environmentPolicyReleaseWindow)
              .values(releaseWindows.map((r) => ({ ...r, policyId: input.id })))
              .returning();
        });
      }

      return ctx.db
        .select()
        .from(environmentPolicy)
        .where(eq(environmentPolicy.id, input.id))
        .then(takeFirst);
    }),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemUpdate)
          .on({ type: "environmentPolicy", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db.transaction((db) =>
        db
          .execute(
            sql`UPDATE environment e
                SET policy_id = ep.id
                FROM environment_policy ep
                WHERE e.id = ep.environment_id
                AND e.policy_id = ${input}
               `,
          )
          .then(() =>
            db
              .delete(environmentPolicy)
              .where(eq(environmentPolicy.id, input))
              .returning()
              .then(takeFirst),
          ),
      ),
    ),
});
