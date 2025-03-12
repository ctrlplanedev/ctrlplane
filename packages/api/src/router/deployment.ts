import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  count,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createDeployment,
  createHook,
  createReleaseChannel,
  deployment,
  environment,
  hook,
  job,
  jobAgent,
  release,
  releaseChannel,
  releaseJobTrigger,
  releaseMatchesCondition,
  resource,
  resourceMatchesMetadata,
  runbook,
  runbookVariable,
  runhook,
  system,
  updateDeployment as updateDeploymentSchema,
  updateHook,
  updateReleaseChannel,
  workspace,
} from "@ctrlplane/db/schema";
import {
  getEventsForDeploymentRemoved,
  handleEvent,
  updateDeployment,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentStatsRouter } from "./deployment-stats";
import { deploymentVariableRouter } from "./deployment-variable";

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

const hookRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.HookList).on({
          type: "deployment",
          id: input,
        }),
    })
    .query(({ ctx, input }) =>
      ctx.db.query.hook
        .findMany({
          where: and(eq(hook.scopeId, input), eq(hook.scopeType, "deployment")),
          with: { runhooks: { with: { runbook: true } } },
        })
        .then((rows) =>
          rows.map((row) => ({
            ...row,
            runhook: row.runhooks[0] ?? null,
          })),
        ),
    ),

  byId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const h = await ctx.db
          .select()
          .from(hook)
          .where(eq(hook.id, input))
          .then(takeFirstOrNull);
        if (h == null) return false;
        if (h.scopeType !== "deployment") return false;
        return canUser.perform(Permission.HookGet).on({
          type: "deployment",
          id: h.scopeId,
        });
      },
    })
    .query(({ ctx, input }) =>
      ctx.db.query.hook.findFirst({ where: eq(hook.id, input) }),
    ),

  create: protectedProcedure
    .input(createHook)
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.HookCreate)
          .on({ type: "deployment", id: input.scopeId }),
    })
    .mutation(async ({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const dep = await tx
          .select()
          .from(deployment)
          .where(eq(deployment.id, input.scopeId))
          .then(takeFirst);
        const h = await tx
          .insert(hook)
          .values(input)
          .returning()
          .then(takeFirst);
        const { jobAgentId, jobAgentConfig } = input;
        if (jobAgentId == null || jobAgentConfig == null)
          return { ...h, runhook: null };

        const rb = await tx
          .insert(runbook)
          .values({
            name: h.name,
            systemId: dep.systemId,
            jobAgentId,
            jobAgentConfig,
          })
          .returning()
          .then(takeFirst);

        if (input.variables.length > 0)
          await tx
            .insert(runbookVariable)
            .values(input.variables.map((v) => ({ ...v, runbookId: rb.id })))
            .returning();

        const rh = await tx
          .insert(runhook)
          .values({ hookId: h.id, runbookId: rb.id })
          .returning()
          .then(takeFirst);
        return { ...h, runhook: rh };
      }),
    ),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), data: updateHook }))
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const h = await ctx.db
          .select()
          .from(hook)
          .where(eq(hook.id, input.id))
          .then(takeFirstOrNull);
        if (h == null) return false;
        if (h.scopeType !== "deployment") return false;
        return canUser.perform(Permission.HookUpdate).on({
          type: "deployment",
          id: h.scopeId,
        });
      },
    })
    .mutation(({ ctx, input }) =>
      ctx.db.transaction(async (tx) => {
        const h = await tx
          .update(hook)
          .set(input.data)
          .where(eq(hook.id, input.id))
          .returning()
          .then(takeFirst);

        const dep = await tx
          .select()
          .from(deployment)
          .where(eq(deployment.id, h.scopeId))
          .then(takeFirst);

        const rh = await tx
          .select()
          .from(runhook)
          .where(eq(runhook.hookId, h.id))
          .then(takeFirstOrNull);

        if (rh != null)
          await tx.delete(runbook).where(eq(runbook.id, rh.runbookId));

        const { jobAgentId, jobAgentConfig } = input.data;
        if (jobAgentId == null || jobAgentConfig == null) {
          return { ...h, runhook: null };
        }

        const rb = await tx
          .insert(runbook)
          .values({
            name: h.name,
            systemId: dep.systemId,
            jobAgentId,
            jobAgentConfig,
          })
          .returning()
          .then(takeFirst);

        if (input.data.variables != null && input.data.variables.length > 0)
          await tx
            .insert(runbookVariable)
            .values(
              input.data.variables.map((v) => ({ ...v, runbookId: rb.id })),
            )
            .returning();

        const updatedRh = await tx
          .insert(runhook)
          .values({ hookId: h.id, runbookId: rb.id })
          .returning()
          .then(takeFirst);
        return { ...h, runhook: updatedRh };
      }),
    ),

  delete: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: async ({ canUser, ctx, input }) => {
        const h = await ctx.db
          .select()
          .from(hook)
          .where(eq(hook.id, input))
          .then(takeFirstOrNull);
        if (h == null) return false;
        if (h.scopeType !== "deployment") return false;
        return canUser.perform(Permission.HookDelete).on({
          type: "deployment",
          id: h.scopeId,
        });
      },
    })
    .mutation(({ ctx, input }) =>
      ctx.db.delete(hook).where(eq(hook.id, input)),
    ),
});

export const deploymentRouter = createTRPCRouter({
  variable: deploymentVariableRouter,
  releaseChannel: releaseChannelRouter,
  hook: hookRouter,
  distributionById: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) => {
      const latestJobsPerResource = ctx.db
        .select({
          id: job.id,
          status: job.status,
          resourceId: releaseJobTrigger.resourceId,
          rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${releaseJobTrigger.resourceId} ORDER BY ${job.createdAt} DESC)`.as(
            "rank",
          ),
        })
        .from(job)
        .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
        .as("latest_jobs");

      return ctx.db
        .select()
        .from(latestJobsPerResource)
        .innerJoin(
          releaseJobTrigger,
          eq(releaseJobTrigger.jobId, latestJobsPerResource.id),
        )
        .innerJoin(release, eq(release.id, releaseJobTrigger.releaseId))
        .innerJoin(resource, eq(resource.id, releaseJobTrigger.resourceId))
        .where(
          and(
            eq(release.deploymentId, input),
            eq(latestJobsPerResource.rank, 1),
            isNull(resource.deletedAt),
          ),
        )
        .then((r) =>
          r.map((row) => ({
            ...row.latest_jobs,
            release: row.deployment_version,
            resource: row.resource,
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
      ctx.db
        .insert(deployment)
        .values({ ...input, description: input.description ?? "" })
        .returning()
        .then(takeFirst),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentUpdate)
          .on({ type: "deployment", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: updateDeploymentSchema }))
    .mutation(({ ctx, input }) =>
      updateDeployment(input.id, input.data, ctx.session.user.id),
    ),

  delete: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentDelete)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string().uuid())
    .mutation(async ({ ctx, input }) => {
      const dep = await ctx.db
        .select()
        .from(deployment)
        .where(eq(deployment.id, input))
        .then(takeFirst);
      const events = await getEventsForDeploymentRemoved(dep, dep.systemId);
      await Promise.allSettled(events.map(handleEvent));
      return ctx.db
        .delete(deployment)
        .where(eq(deployment.id, input))
        .returning()
        .then(takeFirst);
    }),

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
        .leftJoin(
          releaseChannel,
          eq(releaseChannel.deploymentId, deployment.id),
        )
        .where(
          and(
            eq(deployment.slug, deploymentSlug),
            eq(system.slug, systemSlug),
            eq(workspace.slug, workspaceSlug),
          ),
        )
        .then((r) =>
          r[0] == null
            ? null
            : {
                ...r[0].deployment,
                system: { ...r[0].system, workspace: r[0].workspace },
                agent: r[0].job_agent,
                releaseChannels: r
                  .map((r) => r.deployment_version_channel)
                  .filter(isPresent),
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
      return ctx.db
        .select()
        .from(deployment)
        .leftJoin(
          releaseChannel,
          eq(releaseChannel.deploymentId, deployment.id),
        )
        .innerJoin(system, eq(deployment.systemId, system.id))
        .where(eq(deployment.systemId, input))
        .orderBy(deployment.name)
        .then((ts) =>
          _.chain(ts)
            .groupBy((t) => t.deployment.id)
            .map((t) => ({
              ...t[0]!.deployment,
              system: t[0]!.system,
              releaseChannels: _.chain(t)
                .map((a) => a.deployment_version_channel)
                .filter(isPresent)
                .uniqBy((a) => a.id)
                .value(),
            }))
            .value(),
        );
    }),

  byResourceId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentList)
          .on({ type: "resource", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const tg = await ctx.db
        .select()
        .from(resource)
        .where(and(eq(resource.id, input), isNull(resource.deletedAt)))
        .then(takeFirst);

      const envs = await ctx.db
        .select()
        .from(environment)
        .innerJoin(system, eq(environment.systemId, system.id))
        .where(
          and(
            eq(system.workspaceId, tg.workspaceId),
            isNotNull(environment.resourceFilter),
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
              resource,
              resourceMatchesMetadata(ctx.db, env.environment.resourceFilter),
            )
            .leftJoin(
              releaseJobTrigger,
              and(
                eq(releaseJobTrigger.resourceId, resource.id),
                eq(releaseJobTrigger.releaseId, release.id),
                eq(releaseJobTrigger.environmentId, environment.id),
              ),
            )
            .leftJoin(job, eq(releaseJobTrigger.jobId, job.id))
            .where(
              and(
                eq(resource.id, input),
                eq(environment.id, env.environment.id),
                isNull(resource.deletedAt),
                inArray(job.status, [
                  JobStatus.Successful,
                  JobStatus.Pending,
                  JobStatus.InProgress,
                ]),
              ),
            )
            .orderBy(deployment.id, releaseJobTrigger.createdAt)
            .limit(500)
            .then((r) =>
              r.map((row) => ({
                ...row.deployment,
                environment: row.environment,
                system: row.system,
                releaseJobTrigger:
                  row.release_job_trigger != null
                    ? {
                        ...row.release_job_trigger,
                        job: row.job!,
                        release: row.deployment_version!,
                        resourceId: row.resource.id,
                      }
                    : null,
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
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(deployment)
        .innerJoin(system, eq(system.id, deployment.systemId))
        .where(eq(system.workspaceId, input))
        .then((r) =>
          r.map((row) => ({
            ...row.deployment,
            system: row.system,
          })),
        ),
    ),

  stats: deploymentStatsRouter,
});
