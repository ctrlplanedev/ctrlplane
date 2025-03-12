import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  like,
  notExists,
  or,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  createRelease,
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyApproval,
  environmentPolicyReleaseChannel,
  job,
  release,
  releaseChannel,
  releaseDependency,
  releaseJobTrigger,
  releaseMatchesCondition,
  releaseMetadata,
  resource,
  resourceMatchesMetadata,
  system,
  updateRelease,
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
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  activeStatus,
  jobCondition,
  JobStatus,
} from "@ctrlplane/validators/jobs";
import {
  releaseCondition,
  ReleaseStatus,
} from "@ctrlplane/validators/releases";

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
        jobFilter: jobCondition.optional(),
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
      const checks = and(
        ...[deploymentIdCheck, releaseConditionCheck].filter(isPresent),
      )!;

      const getItems = async () =>
        ctx.db
          .select()
          .from(release)
          .leftJoin(
            releaseDependency,
            eq(release.id, releaseDependency.releaseId),
          )
          .where(checks)
          .orderBy(desc(release.createdAt), desc(release.version))
          .limit(input.limit)
          .offset(input.offset)
          .then((data) =>
            _.chain(data)
              .groupBy((r) => r.deployment_version.id)
              .map((r) => ({
                ...r[0]!.deployment_version,
                releaseDependencies: r
                  .map((rd) => rd.deployment_version_dependency)
                  .filter(isPresent),
              }))
              .value(),
          );

      const total = ctx.db
        .select({
          count: count().mapWith(Number),
        })
        .from(release)
        .where(checks)
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
            .groupBy((r) => r.deployment_version.id)
            .map((r) => ({
              ...r[0]!.deployment_version,
              dependencies: r
                .filter(isPresent)
                .map((r) => r.deployment_version_dependency!),
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
      const { name, ...rest } = input;
      const relName = name == null || name === "" ? rest.version : name;
      const rel = await db
        .insert(release)
        .values({ ...rest, name: relName })
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

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateRelease }))
    .mutation(async ({ ctx, input: { id, data } }) =>
      db
        .update(release)
        .set(data)
        .where(eq(release.id, id))
        .returning()
        .then(takeFirst)
        .then((rel) =>
          createReleaseJobTriggers(db, "release_updated")
            .causedById(ctx.session.user.id)
            .filter(isPassingReleaseStringCheckPolicy)
            .releases([rel.id])
            .then(createJobApprovals)
            .insert()
            .then((triggers) =>
              dispatchReleaseJobTriggers(db)
                .releaseTriggers(triggers)
                .filter(isPassingAllPolicies)
                .then(cancelOldReleaseJobTriggersOnJobDispatch)
                .dispatch()
                .then(() => rel),
            ),
        ),
    ),

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
            .groupBy((e) => [e.environment.id, e.deployment_version.id])
            .map((v) => ({
              release: v[0]!.deployment_version,
              environment: v[0]!.environment,
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

        const policyReleaseChannel = environmentPolicy?.releaseChannels.find(
          (rc) => rc.releaseChannelDeploymentId === rel.deploymentId,
        );

        const { releaseChannelId, releaseChannelFilter } =
          policyReleaseChannel ?? {};
        if (releaseChannelFilter == null) return null;

        const matchingRelease = await db
          .select()
          .from(release)
          .where(
            and(
              eq(release.id, rel.id),
              releaseMatchesCondition(db, releaseChannelFilter),
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

  status: createTRPCRouter({
    byEnvironmentId: protectedProcedure
      .input(
        z.object({
          releaseId: z.string().uuid(),
          environmentId: z.string().uuid(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.ReleaseGet).on({
            type: "release",
            id: input.releaseId,
          }),
      })
      .query(({ input: { releaseId, environmentId } }) =>
        db
          .selectDistinctOn([releaseJobTrigger.resourceId])
          .from(job)
          .innerJoin(releaseJobTrigger, eq(job.id, releaseJobTrigger.jobId))
          .innerJoin(resource, eq(releaseJobTrigger.resourceId, resource.id))
          .orderBy(releaseJobTrigger.resourceId, desc(job.createdAt))
          .where(
            and(
              eq(releaseJobTrigger.releaseId, releaseId),
              eq(releaseJobTrigger.environmentId, environmentId),
              isNull(resource.deletedAt),
            ),
          ),
      ),

    bySystemDirectory: protectedProcedure
      .input(
        z
          .object({
            directory: z.string(),
            exact: z.boolean().optional().default(false),
          })
          .and(
            z.union([
              z.object({ deploymentId: z.string().uuid() }),
              z.object({ releaseId: z.string().uuid() }),
            ]),
          ),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          "releaseId" in input
            ? canUser.perform(Permission.ReleaseGet).on({
                type: "release",
                id: input.releaseId,
              })
            : canUser.perform(Permission.DeploymentGet).on({
                type: "deployment",
                id: input.deploymentId,
              }),
      })
      .query(({ input }) => {
        const { directory, exact } = input;
        const isMatchingDirectory = exact
          ? eq(environment.directory, directory)
          : or(
              eq(environment.directory, directory),
              like(environment.directory, `${directory}/%`),
            );

        const releaseCheck =
          "releaseId" in input
            ? eq(release.id, input.releaseId)
            : eq(release.deploymentId, input.deploymentId);

        return db
          .selectDistinctOn([releaseJobTrigger.resourceId])
          .from(job)
          .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
          .innerJoin(resource, eq(releaseJobTrigger.resourceId, resource.id))
          .innerJoin(
            environment,
            eq(releaseJobTrigger.environmentId, environment.id),
          )
          .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
          .orderBy(releaseJobTrigger.resourceId, desc(job.createdAt))
          .where(and(releaseCheck, isMatchingDirectory));
      }),
  }),

  latest: createTRPCRouter({
    completed: protectedProcedure
      .input(
        z.object({
          deploymentId: z.string().uuid(),
          environmentId: z.string().uuid(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.ReleaseGet).on({
            type: "deployment",
            id: input.deploymentId,
          }),
      })
      .query(({ input: { deploymentId, environmentId } }) =>
        db
          .select()
          .from(release)
          .innerJoin(environment, eq(environment.id, environmentId))
          .where(
            and(
              eq(release.deploymentId, deploymentId),
              exists(
                db
                  .select()
                  .from(releaseJobTrigger)
                  .innerJoin(
                    resource,
                    eq(releaseJobTrigger.resourceId, resource.id),
                  )
                  .where(
                    and(
                      eq(releaseJobTrigger.releaseId, release.id),
                      eq(releaseJobTrigger.environmentId, environmentId),
                      isNull(resource.deletedAt),
                    ),
                  )
                  .limit(1),
              ),
              notExists(
                db
                  .select()
                  .from(releaseJobTrigger)
                  .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
                  .innerJoin(
                    resource,
                    eq(releaseJobTrigger.resourceId, resource.id),
                  )
                  .where(
                    and(
                      eq(releaseJobTrigger.releaseId, release.id),
                      eq(releaseJobTrigger.environmentId, environmentId),
                      inArray(job.status, [...activeStatus, JobStatus.Pending]),
                      isNull(resource.deletedAt),
                    ),
                  )
                  .limit(1),
              ),
            ),
          )
          .orderBy(desc(release.createdAt))
          .limit(1)
          .then(takeFirstOrNull)
          .then((r) => r?.deployment_version ?? null),
      ),

    byDeploymentAndEnvironment: protectedProcedure
      .input(
        z.object({
          deploymentId: z.string().uuid(),
          environmentId: z.string().uuid(),
        }),
      )
      .meta({
        authorizationCheck: async ({ canUser, input }) => {
          const { deploymentId, environmentId } = input;
          const deploymentAuthzPromise = canUser
            .perform(Permission.DeploymentGet)
            .on({ type: "deployment", id: deploymentId });
          const environmentAuthzPromise = canUser
            .perform(Permission.EnvironmentGet)
            .on({ type: "environment", id: environmentId });
          const [deployment, environment] = await Promise.all([
            deploymentAuthzPromise,
            environmentAuthzPromise,
          ]);
          return deployment && environment;
        },
      })
      .query(async ({ ctx, input }) => {
        const { deploymentId, environmentId } = input;

        const env = await ctx.db
          .select()
          .from(environment)
          .innerJoin(system, eq(environment.systemId, system.id))
          .innerJoin(
            environmentPolicy,
            eq(environment.policyId, environmentPolicy.id),
          )
          .leftJoin(
            environmentPolicyReleaseChannel,
            and(
              eq(
                environmentPolicyReleaseChannel.policyId,
                environmentPolicy.id,
              ),
              eq(environmentPolicyReleaseChannel.deploymentId, deploymentId),
            ),
          )
          .leftJoin(
            releaseChannel,
            eq(environmentPolicyReleaseChannel.channelId, releaseChannel.id),
          )
          .where(eq(environment.id, environmentId))
          .then(takeFirst);

        const rel = await ctx.db
          .select()
          .from(release)
          .leftJoin(
            environmentPolicyApproval,
            and(
              eq(environmentPolicyApproval.releaseId, release.id),
              eq(environmentPolicyApproval.policyId, env.environment.policyId),
            ),
          )
          .where(
            and(
              eq(release.status, ReleaseStatus.Ready),
              eq(release.deploymentId, deploymentId),
              env.deployment_version_channel != null
                ? releaseMatchesCondition(
                    ctx.db,
                    env.deployment_version_channel.releaseFilter,
                  )
                : undefined,
            ),
          )
          .orderBy(desc(release.createdAt))
          .limit(1)
          .then(takeFirstOrNull);

        if (rel == null) return null;

        const dep = await ctx.db
          .select()
          .from(deployment)
          .where(eq(deployment.id, deploymentId))
          .then(takeFirst);

        if (env.environment.resourceFilter == null)
          return {
            ...rel.deployment_version,
            approval: rel.environment_policy_approval,
            resourceCount: 0,
          };

        const resourceFilter: ResourceCondition = {
          type: FilterType.Comparison,
          operator: ComparisonOperator.And,
          conditions: [
            env.environment.resourceFilter,
            dep.resourceFilter,
          ].filter(isPresent),
        };

        const resourceCount = await ctx.db
          .select({ count: count() })
          .from(resource)
          .where(
            and(
              eq(resource.workspaceId, env.system.workspaceId),
              resourceMatchesMetadata(ctx.db, resourceFilter),
              isNull(resource.deletedAt),
            ),
          )
          .then(takeFirst);

        return {
          ...rel.deployment_version,
          approval: rel.environment_policy_approval,
          resourceCount: resourceCount.count,
        };
      }),
  }),

  metadataKeys: releaseMetadataKeysRouter,
});
