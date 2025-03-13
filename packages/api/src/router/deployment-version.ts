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
import * as SCHEMA from "@ctrlplane/db/schema";
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
import { deploymentVersionMetadataKeysRouter } from "./release-metadata-keys";

export const versionRouter = createTRPCRouter({
  list: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionList)
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
      const deploymentIdCheck = eq(
        SCHEMA.deploymentVersion.deploymentId,
        input.deploymentId,
      );
      const releaseConditionCheck = SCHEMA.deploymentVersionMatchesCondition(
        ctx.db,
        input.filter,
      );
      const checks = and(
        ...[deploymentIdCheck, releaseConditionCheck].filter(isPresent),
      )!;

      const getItems = async () =>
        ctx.db
          .select()
          .from(SCHEMA.deploymentVersion)
          .leftJoin(
            SCHEMA.releaseDependency,
            eq(SCHEMA.deploymentVersion.id, SCHEMA.releaseDependency.releaseId),
          )
          .where(checks)
          .orderBy(
            desc(SCHEMA.deploymentVersion.createdAt),
            desc(SCHEMA.deploymentVersion.version),
          )
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
        .from(SCHEMA.deploymentVersion)
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
          .perform(Permission.DeploymentVersionGet)
          .on({ type: "deploymentVersion", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .leftJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .leftJoin(
          SCHEMA.releaseDependency,
          eq(SCHEMA.releaseDependency.releaseId, SCHEMA.deploymentVersion.id),
        )
        .where(eq(SCHEMA.deploymentVersion.id, input))
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
                .from(SCHEMA.deploymentVersionMetadata)
                .where(eq(SCHEMA.deploymentVersionMetadata.releaseId, data.id))
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
          .perform(Permission.DeploymentVersionCreate)
          .on({ type: "deployment", id: input.deploymentId }),
    })
    .input(SCHEMA.createDeploymentVersion)
    .mutation(async ({ ctx, input }) => {
      const { name, ...rest } = input;
      const relName = name == null || name === "" ? rest.version : name;
      const rel = await db
        .insert(SCHEMA.deploymentVersion)
        .values({ ...rest, name: relName })
        .returning()
        .then(takeFirst);

      const releaseDeps = input.releaseDependencies.map((rd) => ({
        ...rd,
        releaseId: rel.id,
      }));
      if (releaseDeps.length > 0)
        await db.insert(SCHEMA.releaseDependency).values(releaseDeps);

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
    .input(
      z.object({ id: z.string().uuid(), data: SCHEMA.updateDeploymentVersion }),
    )
    .mutation(async ({ ctx, input: { id, data } }) =>
      db
        .update(SCHEMA.deploymentVersion)
        .set(data)
        .where(eq(SCHEMA.deploymentVersion.id, id))
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
        canUser.perform(Permission.DeploymentVersionGet).on(
          ...(input as string[]).map((t) => ({
            type: "deploymentVersion" as const,
            id: t,
          })),
        ),
    })
    .input(z.array(z.string().uuid()))
    .query(async ({ input }) => {
      const policyRCSubquery = db
        .select({
          releaseChannelId: SCHEMA.releaseChannel.id,
          releaseChannelPolicyId:
            SCHEMA.environmentPolicyReleaseChannel.policyId,
          releaseChannelDeploymentId: SCHEMA.releaseChannel.deploymentId,
          releaseChannelFilter: SCHEMA.releaseChannel.releaseFilter,
        })
        .from(SCHEMA.environmentPolicyReleaseChannel)
        .innerJoin(
          SCHEMA.releaseChannel,
          eq(
            SCHEMA.environmentPolicyReleaseChannel.channelId,
            SCHEMA.releaseChannel.id,
          ),
        )
        .as("policyRCSubquery");

      const envs = await db
        .select()
        .from(SCHEMA.deploymentVersion)
        .innerJoin(
          SCHEMA.deployment,
          eq(SCHEMA.deploymentVersion.deploymentId, SCHEMA.deployment.id),
        )
        .innerJoin(
          SCHEMA.environment,
          eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
        )
        .leftJoin(
          SCHEMA.environmentPolicy,
          eq(SCHEMA.environment.policyId, SCHEMA.environmentPolicy.id),
        )
        .leftJoin(
          policyRCSubquery,
          eq(
            policyRCSubquery.releaseChannelPolicyId,
            SCHEMA.environmentPolicy.id,
          ),
        )
        .where(inArray(SCHEMA.deploymentVersion.id, input))
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
          .from(SCHEMA.deploymentVersion)
          .where(
            and(
              eq(SCHEMA.deploymentVersion.id, rel.id),
              SCHEMA.deploymentVersionMatchesCondition(
                db,
                releaseChannelFilter,
              ),
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
          canUser.perform(Permission.DeploymentVersionGet).on({
            type: "deploymentVersion",
            id: input.releaseId,
          }),
      })
      .query(({ input: { releaseId, environmentId } }) =>
        db
          .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId])
          .from(SCHEMA.job)
          .innerJoin(
            SCHEMA.releaseJobTrigger,
            eq(SCHEMA.job.id, SCHEMA.releaseJobTrigger.jobId),
          )
          .innerJoin(
            SCHEMA.resource,
            eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
          )
          .orderBy(
            SCHEMA.releaseJobTrigger.resourceId,
            desc(SCHEMA.job.createdAt),
          )
          .where(
            and(
              eq(SCHEMA.releaseJobTrigger.versionId, releaseId),
              eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
              isNull(SCHEMA.resource.deletedAt),
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
            ? canUser.perform(Permission.DeploymentVersionGet).on({
                type: "deploymentVersion",
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
          ? eq(SCHEMA.environment.directory, directory)
          : or(
              eq(SCHEMA.environment.directory, directory),
              like(SCHEMA.environment.directory, `${directory}/%`),
            );

        const releaseCheck =
          "releaseId" in input
            ? eq(SCHEMA.deploymentVersion.id, input.releaseId)
            : eq(SCHEMA.deploymentVersion.deploymentId, input.deploymentId);

        return db
          .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId])
          .from(SCHEMA.job)
          .innerJoin(
            SCHEMA.releaseJobTrigger,
            eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
          )
          .innerJoin(
            SCHEMA.resource,
            eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
          )
          .innerJoin(
            SCHEMA.environment,
            eq(SCHEMA.releaseJobTrigger.environmentId, SCHEMA.environment.id),
          )
          .innerJoin(
            SCHEMA.deploymentVersion,
            eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
          )
          .orderBy(
            SCHEMA.releaseJobTrigger.resourceId,
            desc(SCHEMA.job.createdAt),
          )
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
          canUser.perform(Permission.DeploymentVersionGet).on({
            type: "deployment",
            id: input.deploymentId,
          }),
      })
      .query(({ input: { deploymentId, environmentId } }) =>
        db
          .select()
          .from(SCHEMA.deploymentVersion)
          .innerJoin(
            SCHEMA.environment,
            eq(SCHEMA.environment.id, environmentId),
          )
          .where(
            and(
              eq(SCHEMA.deploymentVersion.deploymentId, deploymentId),
              exists(
                db
                  .select()
                  .from(SCHEMA.releaseJobTrigger)
                  .innerJoin(
                    SCHEMA.resource,
                    eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
                  )
                  .where(
                    and(
                      eq(
                        SCHEMA.releaseJobTrigger.versionId,
                        SCHEMA.deploymentVersion.id,
                      ),
                      eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
                      isNull(SCHEMA.resource.deletedAt),
                    ),
                  )
                  .limit(1),
              ),
              notExists(
                db
                  .select()
                  .from(SCHEMA.releaseJobTrigger)
                  .innerJoin(
                    SCHEMA.job,
                    eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
                  )
                  .innerJoin(
                    SCHEMA.resource,
                    eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
                  )
                  .where(
                    and(
                      eq(
                        SCHEMA.releaseJobTrigger.versionId,
                        SCHEMA.deploymentVersion.id,
                      ),
                      eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
                      inArray(SCHEMA.job.status, [
                        ...activeStatus,
                        JobStatus.Pending,
                      ]),
                      isNull(SCHEMA.resource.deletedAt),
                    ),
                  )
                  .limit(1),
              ),
            ),
          )
          .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
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
          .from(SCHEMA.environment)
          .innerJoin(
            SCHEMA.system,
            eq(SCHEMA.environment.systemId, SCHEMA.system.id),
          )
          .innerJoin(
            SCHEMA.environmentPolicy,
            eq(SCHEMA.environment.policyId, SCHEMA.environmentPolicy.id),
          )
          .leftJoin(
            SCHEMA.environmentPolicyReleaseChannel,
            and(
              eq(
                SCHEMA.environmentPolicyReleaseChannel.policyId,
                SCHEMA.environmentPolicy.id,
              ),
              eq(
                SCHEMA.environmentPolicyReleaseChannel.deploymentId,
                deploymentId,
              ),
            ),
          )
          .leftJoin(
            SCHEMA.releaseChannel,
            eq(
              SCHEMA.environmentPolicyReleaseChannel.channelId,
              SCHEMA.releaseChannel.id,
            ),
          )
          .where(eq(SCHEMA.environment.id, environmentId))
          .then(takeFirst);

        const rel = await ctx.db
          .select()
          .from(SCHEMA.deploymentVersion)
          .leftJoin(
            SCHEMA.environmentPolicyApproval,
            and(
              eq(
                SCHEMA.environmentPolicyApproval.releaseId,
                SCHEMA.deploymentVersion.id,
              ),
              eq(
                SCHEMA.environmentPolicyApproval.policyId,
                env.environment.policyId,
              ),
            ),
          )
          .where(
            and(
              eq(SCHEMA.deploymentVersion.status, ReleaseStatus.Ready),
              eq(SCHEMA.deploymentVersion.deploymentId, deploymentId),
              env.deployment_version_channel != null
                ? SCHEMA.deploymentVersionMatchesCondition(
                    ctx.db,
                    env.deployment_version_channel.releaseFilter,
                  )
                : undefined,
            ),
          )
          .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
          .limit(1)
          .then(takeFirstOrNull);

        if (rel == null) return null;

        const dep = await ctx.db
          .select()
          .from(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, deploymentId))
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
          .from(SCHEMA.resource)
          .where(
            and(
              eq(SCHEMA.resource.workspaceId, env.system.workspaceId),
              SCHEMA.resourceMatchesMetadata(ctx.db, resourceFilter),
              isNull(SCHEMA.resource.deletedAt),
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

  metadataKeys: deploymentVersionMetadataKeysRouter,
});
