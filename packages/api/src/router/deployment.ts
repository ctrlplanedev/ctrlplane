import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  eq,
  inArray,
  isNotNull,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createDeployment,
  createReleaseChannel,
  deployment,
  environment,
  job,
  jobAgent,
  release,
  releaseChannel,
  releaseJobTrigger,
  releaseMatchesCondition,
  system,
  target,
  targetMatchesMetadata,
  updateDeployment,
  updateReleaseChannel,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentVariableRouter } from "./deployment-variable";

const latestActiveReleaseSubQuery = (db: Tx) =>
  db
    .select({
      id: release.id,
      deploymentId: release.deploymentId,
      version: release.version,
      createdAt: release.createdAt,
      name: release.name,
      config: release.config,
      environmentId: releaseJobTrigger.environmentId,

      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${release.deploymentId}, ${releaseJobTrigger.environmentId} ORDER BY ${release.createdAt} DESC)`.as(
        "rank",
      ),
    })
    .from(release)
    .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.releaseId, release.id))
    .as("active_releases");

const releaseChannelRouter = createTRPCRouter({
  create: protectedProcedure
    .input(createReleaseChannel)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.ReleaseChannelCreate).on({
          type: "deployment",
          id: input.deploymentId,
        }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db.insert(releaseChannel).values(input).returning(),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateReleaseChannel }))
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseChannelUpdate)
          .on({ type: "releaseChannel", id: input.id }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(releaseChannel)
        .set(input.data)
        .where(eq(releaseChannel.id, input.id))
        .returning(),
    ),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseChannelDelete)
          .on({ type: "releaseChannel", id: input }),
    })
    .mutation(({ ctx, input }) =>
      ctx.db.delete(releaseChannel).where(eq(releaseChannel.id, input)),
    ),

  list: createTRPCRouter({
    byDeploymentId: protectedProcedure
      .input(z.string().uuid())
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.ReleaseChannelList)
            .on({ type: "deployment", id: input }),
      })
      .query(async ({ ctx, input }) => {
        const channels = await ctx.db
          .select()
          .from(releaseChannel)
          .where(eq(releaseChannel.deploymentId, input));

        const promises = channels.map(async (channel) => {
          const filter = channel.releaseFilter ?? undefined;
          const total = await ctx.db
            .select({ count: count() })
            .from(release)
            .where(
              and(
                eq(release.deploymentId, channel.deploymentId),
                releaseMatchesCondition(ctx.db, filter),
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
          .perform(Permission.ReleaseChannelGet)
          .on({ type: "releaseChannel", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const rc = await ctx.db.query.releaseChannel.findFirst({
        where: eq(releaseChannel.id, input),
        with: {
          environmentReleaseChannels: { with: { environment: true } },
          environmentPolicyReleaseChannels: {
            with: { environmentPolicy: true },
          },
        },
      });
      if (rc == null) return null;
      const policyIds = rc.environmentPolicyReleaseChannels.map(
        (eprc) => eprc.environmentPolicy.id,
      );

      const envs = await ctx.db
        .select()
        .from(environment)
        .where(inArray(environment.policyId, policyIds));

      return {
        ...rc,
        usage: {
          environments: rc.environmentReleaseChannels.map(
            (erc) => erc.environment,
          ),
          policies: rc.environmentPolicyReleaseChannels.map((eprc) => ({
            ...eprc.environmentPolicy,
            environments: envs.filter(
              (e) => e.policyId === eprc.environmentPolicy.id,
            ),
          })),
        },
      };
    }),
});

export const deploymentRouter = createTRPCRouter({
  variable: deploymentVariableRouter,
  releaseChannel: releaseChannelRouter,
  distributionById: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) => {
      const latestJobsPerTarget = ctx.db
        .select({
          id: job.id,
          status: job.status,
          targetId: releaseJobTrigger.targetId,
          rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${releaseJobTrigger.targetId} ORDER BY ${job.createdAt} DESC)`.as(
            "rank",
          ),
        })
        .from(job)
        .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
        .as("latest_jobs");

      return ctx.db
        .select()
        .from(latestJobsPerTarget)
        .innerJoin(
          releaseJobTrigger,
          eq(releaseJobTrigger.jobId, latestJobsPerTarget.id),
        )
        .innerJoin(release, eq(release.id, releaseJobTrigger.releaseId))
        .innerJoin(target, eq(target.id, releaseJobTrigger.targetId))
        .where(
          and(eq(release.deploymentId, input), eq(latestJobsPerTarget.rank, 1)),
        )
        .then((r) =>
          r.map((row) => ({
            ...row.latest_jobs,
            release: row.release,
            target: row.target,
            releaseJobTrigger: row.release_job_trigger,
          })),
        );
    }),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentCreate)
          .on({ type: "system", id: input.systemId }),
    })
    .input(createDeployment)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(deployment).values(input).returning().then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateDeployment }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(deployment)
        .set(input.data)
        .where(eq(deployment.id, input.id))
        .returning(),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentDelete)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string().uuid())
    .mutation(({ ctx, input }) =>
      ctx.db
        .delete(deployment)
        .where(eq(deployment.id, input))
        .returning()
        .then(takeFirst),
    ),

  byId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(deployment)
        .where(eq(deployment.id, input))
        .then(takeFirst),
    ),

  bySlug: protectedProcedure
    .input(
      z.object({
        workspaceSlug: z.string(),
        deploymentSlug: z.string(),
        systemSlug: z.string(),
      }),
    )
    .meta({
      authorizationCheck: async ({ canUser, input, ctx }) => {
        const { workspaceSlug, deploymentSlug, systemSlug } = input;
        const sys = await ctx.db
          .select()
          .from(deployment)
          .innerJoin(system, eq(system.id, deployment.systemId))
          .innerJoin(workspace, eq(system.workspaceId, workspace.id))
          .leftJoin(jobAgent, eq(jobAgent.id, deployment.jobAgentId))
          .where(
            and(
              eq(deployment.slug, deploymentSlug),
              eq(system.slug, systemSlug),
              eq(workspace.slug, workspaceSlug),
            ),
          )
          .then(takeFirstOrNull);
        if (sys == null) return null;
        return canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "system", id: sys.system.id });
      },
    })
    .query(({ ctx, input: { workspaceSlug, deploymentSlug, systemSlug } }) =>
      ctx.db
        .select()
        .from(deployment)
        .innerJoin(system, eq(system.id, deployment.systemId))
        .innerJoin(workspace, eq(system.workspaceId, workspace.id))
        .leftJoin(jobAgent, eq(jobAgent.id, deployment.jobAgentId))
        .where(
          and(
            eq(deployment.slug, deploymentSlug),
            eq(system.slug, systemSlug),
            eq(workspace.slug, workspaceSlug),
          ),
        )
        .then(takeFirstOrNull)
        .then((r) =>
          r == null
            ? null
            : {
                ...r.deployment,
                system: { ...r.system, workspace: r.workspace },
                agent: r.job_agent,
              },
        ),
    ),

  bySystemId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "system", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const activeRelease = latestActiveReleaseSubQuery(ctx.db);
      return ctx.db
        .select()
        .from(deployment)
        .leftJoin(
          activeRelease,
          and(
            eq(activeRelease.deploymentId, deployment.id),
            eq(activeRelease.rank, 1),
          ),
        )
        .leftJoin(
          releaseChannel,
          eq(releaseChannel.deploymentId, deployment.id),
        )
        .where(eq(deployment.systemId, input))
        .orderBy(deployment.name)
        .then((ts) =>
          _.chain(ts)
            .groupBy((t) => t.deployment.id)
            .map((t) => ({
              ...t[0]!.deployment,
              // latest active release subquery can return multiple active releases
              // and multiple release channels, which means we need to dedupe them
              // since there will be a row per combination of active release and release channel
              activeReleases: _.chain(t)
                .map((a) => a.active_releases)
                .filter(isPresent)
                .uniqBy((a) => a.environmentId)
                .value(),
              releaseChannels: _.chain(t)
                .map((a) => a.release_channel)
                .filter(isPresent)
                .uniqBy((a) => a.id)
                .value(),
            }))
            .value(),
        );
    }),

  byTargetId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "target", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const tg = await ctx.db
        .select()
        .from(target)
        .where(eq(target.id, input))
        .then(takeFirst);

      const envs = await ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(environment.systemId, system.id))
        .where(
          and(
            eq(system.workspaceId, tg.workspaceId),
            isNotNull(environment.targetFilter),
          ),
        );

      return Promise.all(
        envs.map((env) =>
          ctx.db
            .select()
            .from(deployment)
            .innerJoin(system, eq(system.id, deployment.systemId))
            .innerJoin(environment, eq(environment.systemId, system.id))
            .leftJoin(release, eq(release.deploymentId, deployment.id))
            .innerJoin(
              target,
              targetMatchesMetadata(ctx.db, env.environment.targetFilter),
            )
            .leftJoin(
              releaseJobTrigger,
              and(
                eq(releaseJobTrigger.targetId, target.id),
                eq(releaseJobTrigger.releaseId, release.id),
                eq(releaseJobTrigger.environmentId, environment.id),
              ),
            )
            .leftJoin(job, eq(releaseJobTrigger.jobId, job.id))

            .where(
              and(
                eq(target.id, input),
                inArray(job.status, [
                  JobStatus.Completed,
                  JobStatus.Pending,
                  JobStatus.InProgress,
                ]),
              ),
            )
            .orderBy(deployment.id, releaseJobTrigger.createdAt)
            .then((r) =>
              r.map((row) => ({
                ...row.deployment,
                environment: row.environment,
                system: row.system,
                releaseJobTrigger: {
                  ...row.release_job_trigger,
                  job: row.job,
                  release: row.release,
                },
              })),
            ),
        ),
      ).then((r) => r.flat());
    }),

  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(async ({ ctx, input }) => {
      const activeRelease = latestActiveReleaseSubQuery(ctx.db);
      return ctx.db
        .select()
        .from(deployment)
        .innerJoin(system, eq(system.id, deployment.systemId))
        .leftJoin(
          activeRelease,
          and(
            eq(activeRelease.deploymentId, deployment.id),
            eq(activeRelease.rank, 1),
          ),
        )
        .where(eq(system.workspaceId, input))
        .then((r) =>
          r.map((row) => ({
            ...row.deployment,
            latestActiveReleases: row.active_releases,
          })),
        );
    }),
});
