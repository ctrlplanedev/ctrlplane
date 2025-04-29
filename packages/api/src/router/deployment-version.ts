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
  selector,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  createJobApprovals,
  createReleaseJobTriggers,
  dispatchReleaseJobTriggers,
  isPassingAllPolicies,
  isPassingChannelSelectorPolicy,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import {
  activeStatus,
  jobCondition,
  JobStatus,
} from "@ctrlplane/validators/jobs";
import {
  deploymentVersionCondition,
  DeploymentVersionStatus,
} from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentVersionChecksRouter } from "./deployment-version-checks";
import { deploymentVersionJobsRouter } from "./deployment-version-jobs";
import { versionDeployRouter } from "./version-deploy";
import { deploymentVersionMetadataKeysRouter } from "./version-metadata-keys";

const versionChannelRouter = createTRPCRouter({
  create: protectedProcedure
    .input(SCHEMA.createDeploymentVersionChannel)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionChannelCreate).on({
          type: "deployment",
          id: input.deploymentId,
        }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db.insert(SCHEMA.deploymentVersionChannel).values(input).returning(),
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: SCHEMA.updateDeploymentVersionChannel,
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionChannelUpdate)
          .on({ type: "deploymentVersionChannel", id: input.id }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(SCHEMA.deploymentVersionChannel)
        .set(input.data)
        .where(eq(SCHEMA.deploymentVersionChannel.id, input.id))
        .returning(),
    ),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionChannelDelete)
          .on({ type: "deploymentVersionChannel", id: input }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(SCHEMA.deploymentVersionChannel)
        .where(eq(SCHEMA.deploymentVersionChannel.id, input)),
    ),

  list: createTRPCRouter({
    byDeploymentId: protectedProcedure
      .input(z.string().uuid())
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.DeploymentVersionChannelList)
            .on({ type: "deployment", id: input }),
      })
      .query(async ({ ctx, input }) => {
        const channels = await ctx.db
          .select()
          .from(SCHEMA.deploymentVersionChannel)
          .where(eq(SCHEMA.deploymentVersionChannel.deploymentId, input));

        const promises = channels.map(async (channel) => {
          const filter = channel.versionSelector ?? undefined;
          const total = await ctx.db
            .select({ count: count() })
            .from(SCHEMA.deploymentVersion)
            .where(
              and(
                eq(SCHEMA.deploymentVersion.deploymentId, channel.deploymentId),
                SCHEMA.deploymentVersionMatchesCondition(ctx.db, filter),
              ),
            )
            .then(takeFirst)
            .then((r) => r.count);
          return { ...channel, total };
        });
        return Promise.all(promises);
      }),
  }),

  byId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentVersionChannelGet)
          .on({ type: "deploymentVersionChannel", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const rc = await ctx.db
        .select()
        .from(SCHEMA.deploymentVersionChannel)
        .leftJoin(
          SCHEMA.environmentPolicyDeploymentVersionChannel,
          eq(
            SCHEMA.environmentPolicyDeploymentVersionChannel.channelId,
            SCHEMA.deploymentVersionChannel.id,
          ),
        )
        .leftJoin(
          SCHEMA.environmentPolicy,
          eq(
            SCHEMA.environmentPolicyDeploymentVersionChannel.policyId,
            SCHEMA.environmentPolicy.id,
          ),
        )
        .where(eq(SCHEMA.deploymentVersionChannel.id, input))
        .then((rows) => {
          const first = rows[0];
          if (first == null) return null;

          const channels = _.chain(rows)
            .groupBy((r) => r.deployment_version_channel.id)
            .map((r) => ({
              ...r[0]!.deployment_version_channel,
              policies: r.map((r) => r.environment_policy).filter(isPresent),
            }))
            .value();

          return { ...first.deployment_version_channel, channels };
        });

      if (rc == null) return null;
      const policyIds = rc.channels.flatMap((c) => c.policies.map((p) => p.id));

      const envs = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(inArray(SCHEMA.environment.policyId, policyIds));

      return {
        ...rc,
        usage: {
          policies: rc.channels.flatMap((c) =>
            c.policies.map((p) => ({
              ...p,
              environments: envs.filter((e) => e.policyId === p.id),
            })),
          ),
        },
      };
    }),
});

export const versionRouter = createTRPCRouter({
  channel: versionChannelRouter,
  job: deploymentVersionJobsRouter,
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
        filter: deploymentVersionCondition.optional(),
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

      const filterCheck = selector()
        .query()
        .deploymentVersions()
        .where(input.filter)
        .sql();

      const checks = and(deploymentIdCheck, filterCheck);

      const items = ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .leftJoin(
          SCHEMA.versionDependency,
          eq(SCHEMA.versionDependency.versionId, SCHEMA.deploymentVersion.id),
        )
        .where(checks)
        .orderBy(
          desc(SCHEMA.deploymentVersion.createdAt),
          desc(SCHEMA.deploymentVersion.tag),
        )
        .limit(input.limit)
        .offset(input.offset)
        .then((data) =>
          _.chain(data)
            .groupBy((r) => r.deployment_version.id)
            .map((r) => ({
              ...r[0]!.deployment_version,
              versionDependencies: r
                .map((rd) => rd.deployment_version_dependency)
                .filter(isPresent),
            }))
            .value(),
        );

      const total = ctx.db
        .select({ count: count().mapWith(Number) })
        .from(SCHEMA.deploymentVersion)
        .where(checks)
        .then(takeFirst)
        .then((t) => t.count);

      return Promise.all([items, total]).then(([items, total]) => ({
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
          SCHEMA.versionDependency,
          eq(SCHEMA.versionDependency.versionId, SCHEMA.deploymentVersion.id),
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
                .where(eq(SCHEMA.deploymentVersionMetadata.versionId, data.id))
                .then((r) => r.map((k) => [k.key, k.value])),
            ),
          };
        }),
    ),

  deploy: versionDeployRouter,

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
      const relName = name == null || name === "" ? rest.tag : name;
      const rel = await db
        .insert(SCHEMA.deploymentVersion)
        .values({ ...rest, name: relName })
        .returning()
        .then(takeFirst);

      const versionDeps = input.versionDependencies.map((rd) => ({
        ...rd,
        versionId: rel.id,
      }));
      if (versionDeps.length > 0)
        await db.insert(SCHEMA.versionDependency).values(versionDeps);

      const releaseJobTriggers = await createReleaseJobTriggers(
        db,
        "new_version",
      )
        .causedById(ctx.session.user.id)
        .filter(isPassingChannelSelectorPolicy)
        .versions([rel.id])
        .then(createJobApprovals)
        .insert();

      await dispatchReleaseJobTriggers(db)
        .releaseTriggers(releaseJobTriggers)
        .filter(isPassingAllPolicies)
        .then(cancelOldReleaseJobTriggersOnJobDispatch)
        .dispatch();

      getQueue(Channel.NewDeploymentVersion).add(rel.id, rel);

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
          createReleaseJobTriggers(db, "version_updated")
            .causedById(ctx.session.user.id)
            .filter(isPassingChannelSelectorPolicy)
            .versions([rel.id])
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
          deploymentVersionChannelId: SCHEMA.deploymentVersionChannel.id,
          deploymentVersionChannelPolicyId:
            SCHEMA.environmentPolicyDeploymentVersionChannel.policyId,
          deploymentVersionChannelDeploymentId:
            SCHEMA.deploymentVersionChannel.deploymentId,
          deploymentVersionChannelVersionSelector:
            SCHEMA.deploymentVersionChannel.versionSelector,
        })
        .from(SCHEMA.environmentPolicyDeploymentVersionChannel)
        .innerJoin(
          SCHEMA.deploymentVersionChannel,
          eq(
            SCHEMA.environmentPolicyDeploymentVersionChannel.channelId,
            SCHEMA.deploymentVersionChannel.id,
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
            policyRCSubquery.deploymentVersionChannelPolicyId,
            SCHEMA.environmentPolicy.id,
          ),
        )
        .where(inArray(SCHEMA.deploymentVersion.id, input))
        .then((rows) =>
          _.chain(rows)
            .groupBy((e) => [e.environment.id, e.deployment_version.id])
            .map((v) => ({
              version: v[0]!.deployment_version,
              environment: v[0]!.environment,
              environmentPolicy: v[0]!.environment_policy
                ? {
                    ...v[0]!.environment_policy,
                    versionChannels: v
                      .map((e) => e.policyRCSubquery)
                      .filter(isPresent),
                  }
                : null,
            }))
            .value(),
        );

      const blockedEnvsPromises = envs.map(async (env) => {
        const { version: rel, environment, environmentPolicy } = env;

        const policyVersionChannel = environmentPolicy?.versionChannels.find(
          (rc) => rc.deploymentVersionChannelDeploymentId === rel.deploymentId,
        );

        const {
          deploymentVersionChannelId,
          deploymentVersionChannelVersionSelector,
        } = policyVersionChannel ?? {};
        if (deploymentVersionChannelVersionSelector == null) return null;

        const matchingVersion = await db
          .select()
          .from(SCHEMA.deploymentVersion)
          .where(
            and(
              eq(SCHEMA.deploymentVersion.id, rel.id),
              SCHEMA.deploymentVersionMatchesCondition(
                db,
                deploymentVersionChannelVersionSelector,
              ),
            ),
          )
          .then(takeFirstOrNull);

        return matchingVersion == null
          ? {
              versionId: rel.id,
              environmentId: environment.id,
              deploymentVersionChannelId,
            }
          : null;
      });

      return Promise.all(blockedEnvsPromises).then((r) => r.filter(isPresent));
    }),

  status: createTRPCRouter({
    byEnvironmentId: protectedProcedure
      .input(
        z.object({
          versionId: z.string().uuid(),
          environmentId: z.string().uuid(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser.perform(Permission.EnvironmentGet).on({
            type: "environment",
            id: input.environmentId,
          }),
      })
      .query(({ input: { versionId, environmentId } }) =>
        db
          .selectDistinctOn([SCHEMA.releaseTarget.resourceId])
          .from(SCHEMA.job)
          .innerJoin(
            SCHEMA.releaseJob,
            eq(SCHEMA.job.id, SCHEMA.releaseJob.jobId),
          )
          .innerJoin(
            SCHEMA.release,
            eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
          )
          .innerJoin(
            SCHEMA.versionRelease,
            eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
          )
          .innerJoin(
            SCHEMA.releaseTarget,
            eq(SCHEMA.versionRelease.releaseTargetId, SCHEMA.releaseTarget.id),
          )
          .where(
            and(
              eq(SCHEMA.releaseTarget.environmentId, environmentId),
              eq(SCHEMA.versionRelease.versionId, versionId),
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
              z.object({ versionId: z.string().uuid() }),
            ]),
          ),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          "versionId" in input
            ? canUser.perform(Permission.DeploymentVersionGet).on({
                type: "deploymentVersion",
                id: input.versionId,
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
          "versionId" in input
            ? eq(SCHEMA.deploymentVersion.id, input.versionId)
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
            SCHEMA.environmentPolicyDeploymentVersionChannel,
            and(
              eq(
                SCHEMA.environmentPolicyDeploymentVersionChannel.policyId,
                SCHEMA.environmentPolicy.id,
              ),
              eq(
                SCHEMA.environmentPolicyDeploymentVersionChannel.deploymentId,
                deploymentId,
              ),
            ),
          )
          .leftJoin(
            SCHEMA.deploymentVersionChannel,
            eq(
              SCHEMA.environmentPolicyDeploymentVersionChannel.channelId,
              SCHEMA.deploymentVersionChannel.id,
            ),
          )
          .where(eq(SCHEMA.environment.id, environmentId))
          .then(takeFirst);

        const version = await ctx.db
          .select()
          .from(SCHEMA.deploymentVersion)
          .leftJoin(
            SCHEMA.environmentPolicyApproval,
            and(
              eq(
                SCHEMA.environmentPolicyApproval.deploymentVersionId,
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
              eq(
                SCHEMA.deploymentVersion.status,
                DeploymentVersionStatus.Ready,
              ),
              eq(SCHEMA.deploymentVersion.deploymentId, deploymentId),
              env.deployment_version_channel != null
                ? SCHEMA.deploymentVersionMatchesCondition(
                    ctx.db,
                    env.deployment_version_channel.versionSelector,
                  )
                : undefined,
            ),
          )
          .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
          .limit(1)
          .then(takeFirstOrNull);

        if (version == null) return null;

        const dep = await ctx.db
          .select()
          .from(SCHEMA.deployment)
          .where(eq(SCHEMA.deployment.id, deploymentId))
          .then(takeFirst);

        if (env.environment.resourceSelector == null)
          return {
            ...version.deployment_version,
            approval: version.environment_policy_approval,
            resourceCount: 0,
          };

        const resourceSelector: ResourceCondition = {
          type: ConditionType.Comparison,
          operator: ComparisonOperator.And,
          conditions: [
            env.environment.resourceSelector,
            dep.resourceSelector,
          ].filter(isPresent),
        };

        const resourceCount = await ctx.db
          .select({ count: count() })
          .from(SCHEMA.resource)
          .where(
            and(
              eq(SCHEMA.resource.workspaceId, env.system.workspaceId),
              SCHEMA.resourceMatchesMetadata(ctx.db, resourceSelector),
              isNull(SCHEMA.resource.deletedAt),
            ),
          )
          .then(takeFirst);

        return {
          ...version.deployment_version,
          approval: version.environment_policy_approval,
          resourceCount: resourceCount.count,
        };
      }),
  }),

  metadataKeys: deploymentVersionMetadataKeysRouter,
  checks: deploymentVersionChecksRouter,
});
