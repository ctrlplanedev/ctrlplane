import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createRelease,
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyReleaseChannel,
  environmentReleaseChannel,
  job,
  release,
  releaseChannel,
  releaseDependency,
  releaseJobTrigger,
  releaseMatchesCondition,
  releaseMetadata,
  resource,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingReleaseStringCheckPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { releaseCondition } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { releaseDeployRouter } from "./release-deploy";
import { releaseMetadataKeysRouter } from "./release-metadata-keys";

export const releaseRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseList)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(
      z.object({
        deploymentId: z.string(),
        filter: releaseCondition.optional(),
        limit: z.number().nonnegative().default(100),
        offset: z.number().nonnegative().default(0),
      }),
    )
    .query(({ ctx, input }) => {
      const deploymentIdCheck = eq(release.deploymentId, input.deploymentId);
      const releaseConditionCheck = releaseMatchesCondition(
        ctx.db,
        input.filter,
      );
      const checks = [deploymentIdCheck, releaseConditionCheck].filter(
        isPresent,
      );

      const getItems = async () => {
        const items = await ctx.db
          .select()
          .from(release)
          .leftJoin(
            releaseDependency,
            eq(release.id, releaseDependency.releaseId),
          )
          .where(
            and(
              ...[
                eq(release.deploymentId, input.deploymentId),
                releaseMatchesCondition(ctx.db, input.filter),
              ].filter(isPresent),
            ),
          )
          .orderBy(desc(release.createdAt), desc(release.version))
          .limit(input.limit)
          .offset(input.offset)
          .then((data) =>
            _.chain(data)
              .groupBy((r) => r.release.id)
              .map((r) => ({
                ...r[0]!.release,
                releaseDependencies: r
                  .map((rd) => rd.release_dependency)
                  .filter(isPresent),
              }))
              .value(),
          );

        const jobTriggers = await ctx.db
          .select()
          .from(releaseJobTrigger)
          .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
          .innerJoin(resource, eq(releaseJobTrigger.resourceId, resource.id))
          .where(
            inArray(
              releaseJobTrigger.releaseId,
              items.map((r) => r.id),
            ),
          );

        return items.map((r) => ({
          ...r,
          releaseJobTriggers: jobTriggers
            .filter((j) => j.release_job_trigger.releaseId === r.id)
            .map((j) => ({
              ...j.release_job_trigger,
              job: j.job,
              target: j.resource,
              resource: j.resource,
            })),
        }));
      };

      const total = ctx.db
        .select({
          count: count().mapWith(Number),
        })
        .from(release)
        .where(and(...checks))
        .then(takeFirst)
        .then((t) => t.count);

      return Promise.all([getItems(), total]).then(([items, total]) => ({
        items,
        total,
      }));
    }),

  byId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseGet)
          .on({ type: "release", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(release)
        .leftJoin(deployment, eq(release.deploymentId, deployment.id))
        .leftJoin(
          releaseDependency,
          eq(releaseDependency.releaseId, release.id),
        )
        .where(eq(release.id, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy((r) => r.release.id)
            .map((r) => ({
              ...r[0]!.release,
              dependencies: r
                .filter(isPresent)
                .map((r) => r.release_dependency!),
            }))
            .value()
            .at(0),
        )
        .then(async (data) => {
          if (data == null) return null;
          return {
            ...data,
            metadata: Object.fromEntries(
              await ctx.db
                .select()
                .from(releaseMetadata)
                .where(eq(releaseMetadata.releaseId, data.id))
                .then((r) => r.map((k) => [k.key, k.value])),
            ),
          };
        }),
    ),

  deploy: releaseDeployRouter,

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseCreate)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(createRelease)
    .mutation(async ({ ctx, input }) => {
      const rel = await db
        .insert(release)
        .values(input)
        .returning()
        .then(takeFirst);

      const releaseDeps = input.releaseDependencies.map((rd) => ({
        ...rd,
        releaseId: rel.id,
      }));
      if (releaseDeps.length > 0)
        await db.insert(releaseDependency).values(releaseDeps);

      const releaseJobTriggers = await createReleaseJobTriggers(
        db,
        "new_release",
      )
        .causedById(ctx.session.user.id)
        .filter(isPassingReleaseStringCheckPolicy)
        .releases([rel.id])
        .then(createJobApprovals)
        .insert();

      await dispatchReleaseJobTriggers(db)
        .releaseTriggers(releaseJobTriggers)
        .filter(isPassingAllPolicies)
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();

      return { ...rel, releaseJobTriggers };
    }),

  blocked: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ReleaseGet).on(
          ...(input as string[]).map((t) => ({
            type: "release" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .query(async ({ input }) => {
      const envRCSubquery = db
        .select({
          releaseChannelId: releaseChannel.id,
          releaseChannelEnvId: environmentReleaseChannel.environmentId,
          releaseChannelDeploymentId: releaseChannel.deploymentId,
          releaseChannelFilter: releaseChannel.releaseFilter,
        })
        .from(environmentReleaseChannel)
        .innerJoin(
          releaseChannel,
          eq(environmentReleaseChannel.channelId, releaseChannel.id),
        )
        .as("envRCSubquery");

      const policyRCSubquery = db
        .select({
          releaseChannelId: releaseChannel.id,
          releaseChannelPolicyId: environmentPolicyReleaseChannel.policyId,
          releaseChannelDeploymentId: releaseChannel.deploymentId,
          releaseChannelFilter: releaseChannel.releaseFilter,
        })
        .from(environmentPolicyReleaseChannel)
        .innerJoin(
          releaseChannel,
          eq(environmentPolicyReleaseChannel.channelId, releaseChannel.id),
        )
        .as("policyRCSubquery");

      const envs = await db
        .select()
        .from(release)
        .innerJoin(deployment, eq(release.deploymentId, deployment.id))
        .innerJoin(environment, eq(deployment.systemId, environment.systemId))
        .leftJoin(
          envRCSubquery,
          eq(envRCSubquery.releaseChannelEnvId, environment.id),
        )
        .leftJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .leftJoin(
          policyRCSubquery,
          eq(policyRCSubquery.releaseChannelPolicyId, environmentPolicy.id),
        )
        .where(inArray(release.id, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy((e) => [e.environment.id, e.release.id])
            .map((v) => ({
              release: v[0]!.release,
              environment: {
                ...v[0]!.environment,
                releaseChannels: v
                  .map((e) => e.envRCSubquery)
                  .filter(isPresent),
              },
              environmentPolicy: v[0]!.environment_policy
                ? {
                    ...v[0]!.environment_policy,
                    releaseChannels: v
                      .map((e) => e.policyRCSubquery)
                      .filter(isPresent),
                  }
                : null,
            }))
            .value(),
        );

      const blockedEnvsPromises = envs.map(async (env) => {
        const { release: rel, environment, environmentPolicy } = env;

        const envReleaseChannel = environment.releaseChannels.find(
          (rc) => rc.releaseChannelDeploymentId === rel.deploymentId,
        );

        const policyReleaseChannel = environmentPolicy?.releaseChannels.find(
          (rc) => rc.releaseChannelDeploymentId === rel.deploymentId,
        );

        const releaseFilter =
          envReleaseChannel?.releaseChannelFilter ??
          policyReleaseChannel?.releaseChannelFilter;
        if (releaseFilter == null) return null;

        const releaseChannelId =
          envReleaseChannel?.releaseChannelId ??
          policyReleaseChannel?.releaseChannelId;

        const matchingRelease = await db
          .select()
          .from(release)
          .where(
            and(
              eq(release.id, rel.id),
              releaseMatchesCondition(db, releaseFilter),
            ),
          )
          .then(takeFirstOrNull);

        return matchingRelease == null
          ? {
              releaseId: rel.id,
              environmentId: environment.id,
              releaseChannelId,
            }
          : null;
      });

      return Promise.all(blockedEnvsPromises).then((r) => r.filter(isPresent));
    }),

  metadataKeys: releaseMetadataKeysRouter,
});
