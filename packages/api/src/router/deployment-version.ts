import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  selector,
  takeFirst,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, dispatchQueueJob, getQueue } from "@ctrlplane/events";
import { Permission } from "@ctrlplane/validators/auth";
import { jobCondition } from "@ctrlplane/validators/jobs";
import { deploymentVersionCondition } from "@ctrlplane/validators/releases";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentVersionJobsRouter } from "./deployment-version-jobs";
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
      const rel = await ctx.db
        .insert(SCHEMA.deploymentVersion)
        .values({ ...rest, name: relName })
        .returning()
        .then(takeFirst);

      const versionDeps = input.versionDependencies.map((rd) => ({
        ...rd,
        versionId: rel.id,
      }));
      if (versionDeps.length > 0)
        await ctx.db.insert(SCHEMA.versionDependency).values(versionDeps);

      getQueue(Channel.NewDeploymentVersion).add(rel.id, rel);

      return rel;
    }),

  update: protectedProcedure
    .input(
      z.object({ id: z.string().uuid(), data: SCHEMA.updateDeploymentVersion }),
    )
    .mutation(async ({ input: { id, data } }) =>
      db
        .update(SCHEMA.deploymentVersion)
        .set(data)
        .where(eq(SCHEMA.deploymentVersion.id, id))
        .returning()
        .then(takeFirst)
        .then((rel) =>
          getQueue(Channel.NewDeploymentVersion)
            .add(rel.id, rel)
            .then(() => rel),
        ),
    ),

  addApprovalRecord: protectedProcedure
    .input(
      z.object({
        deploymentVersionId: z.string().uuid(),
        environmentId: z.string().uuid(),
        status: z.nativeEnum(SCHEMA.ApprovalStatus),
        reason: z.string().optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.DeploymentVersionGet).on({
          type: "deploymentVersion",
          id: input.deploymentVersionId,
        }),
    })
    .mutation(async ({ ctx, input }) => {
      const { deploymentVersionId, environmentId, status, reason } = input;

      const record = await ctx.db
        .insert(SCHEMA.policyRuleAnyApprovalRecord)
        .values({
          deploymentVersionId,
          userId: ctx.session.user.id,
          status,
          reason,
          approvedAt:
            status === SCHEMA.ApprovalStatus.Approved ? new Date() : null,
        })
        .returning();

      const rows = await ctx.db
        .select()
        .from(SCHEMA.deploymentVersion)
        .innerJoin(
          SCHEMA.releaseTarget,
          eq(
            SCHEMA.deploymentVersion.deploymentId,
            SCHEMA.releaseTarget.deploymentId,
          ),
        )
        .where(
          and(
            eq(SCHEMA.deploymentVersion.id, deploymentVersionId),
            eq(SCHEMA.releaseTarget.environmentId, environmentId),
          ),
        );

      const targets = rows.map((row) => row.release_target);
      await dispatchQueueJob().toEvaluate().releaseTargets(targets);

      return record;
    }),

  status: createTRPCRouter({
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
          .selectDistinctOn([SCHEMA.releaseTarget.resourceId])
          .from(SCHEMA.job)
          .innerJoin(
            SCHEMA.releaseJob,
            eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id),
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
          .innerJoin(
            SCHEMA.resource,
            eq(SCHEMA.releaseTarget.resourceId, SCHEMA.resource.id),
          )
          .innerJoin(
            SCHEMA.environment,
            eq(SCHEMA.releaseTarget.environmentId, SCHEMA.environment.id),
          )
          .innerJoin(
            SCHEMA.deploymentVersion,
            eq(SCHEMA.versionRelease.versionId, SCHEMA.deploymentVersion.id),
          )
          .orderBy(SCHEMA.releaseTarget.resourceId, desc(SCHEMA.job.createdAt))
          .where(and(releaseCheck, isMatchingDirectory));
      }),
  }),

  metadataKeys: deploymentVersionMetadataKeysRouter,
});
