import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import {
  and,
  eq,
  inArray,
  isNotNull,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createDeployment,
  deployment,
  environment,
  job,
  jobAgent,
  release,
  releaseJobTrigger,
  system,
  target,
  targetMatchesMetadata,
  updateDeployment,
  workspace,
} from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentVariableRouter } from "./deployment-variable";

const latestReleaseSubQuery = (db: Tx) =>
  db
    .select({
      id: release.id,
      deploymentId: release.deploymentId,
      version: release.version,
      createdAt: release.createdAt,
      name: release.name,
      config: release.config,

      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY deployment_id ORDER BY created_at DESC)`.as(
        "rank",
      ),
    })
    .from(release)
    .as("release");

export const deploymentRouter = createTRPCRouter({
  variable: deploymentVariableRouter,
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
          rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY release_job_trigger.target_id ORDER BY job.created_at DESC)`.as(
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
          .then(takeFirst);
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
      const latestRelease = latestReleaseSubQuery(ctx.db);
      return ctx.db
        .select()
        .from(deployment)
        .leftJoin(
          latestRelease,
          and(
            eq(latestRelease.deploymentId, deployment.id),
            eq(latestRelease.rank, 1),
          ),
        )
        .where(eq(deployment.systemId, input))
        .then((r) =>
          r.map((row) => ({ ...row.deployment, latestRelease: row.release })),
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
      const latestRelease = latestReleaseSubQuery(ctx.db);
      return ctx.db
        .select()
        .from(deployment)
        .innerJoin(system, eq(system.id, deployment.systemId))
        .leftJoin(
          latestRelease,
          and(
            eq(latestRelease.deploymentId, deployment.id),
            eq(latestRelease.rank, 1),
          ),
        )
        .where(eq(system.workspaceId, input))
        .then((r) =>
          r.map((row) => ({ ...row.deployment, latestRelease: row.release })),
        );
    }),
});
