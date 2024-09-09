import type { Tx } from "@ctrlplane/db";
import { z } from "zod";

import {
  and,
  arrayContains,
  eq,
  inArray,
  isNull,
  or,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import {
  createDeployment,
  deployment,
  environment,
  jobAgent,
  jobConfig,
  jobExecution,
  release,
  system,
  target,
  updateDeployment,
  workspace,
} from "@ctrlplane/db/schema";
import {
  cancelOldJobConfigsOnJobDispatch,
  dispatchJobConfigs,
  isPassingAllPolicies,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure } from "../trpc";
import { deploymentVariableRouter } from "./deployment-variable";

const latestReleaseSubQuery = (db: Tx) =>
  db
    .select({
      id: release.id,
      deploymentId: release.deploymentId,
      version: release.version,
      createdAt: release.createdAt,

      rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY deployment_id ORDER BY created_at DESC)`.as(
        "rank",
      ),
    })
    .from(release)
    .as("release");

export const deploymentRouter = createTRPCRouter({
  variable: deploymentVariableRouter,
  distrubtionById: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) => {
      const latestCompletedJobExecution = ctx.db
        .select({
          id: jobExecution.id,
          jobConfigId: jobExecution.jobConfigId,
          status: jobExecution.status,
          rank: sql<number>`ROW_NUMBER() OVER (PARTITION BY job_config.target_id, job_config.environment_id ORDER BY job_config.created_at DESC)`.as(
            "rank",
          ),
        })
        .from(jobExecution)
        .innerJoin(jobConfig, eq(jobConfig.id, jobExecution.jobConfigId))
        .where(eq(jobExecution.status, "completed"))
        .as("jobExecution");

      return ctx.db
        .select()
        .from(latestCompletedJobExecution)
        .innerJoin(
          jobConfig,
          eq(jobConfig.id, latestCompletedJobExecution.jobConfigId),
        )
        .innerJoin(release, eq(release.id, jobConfig.releaseId))
        .innerJoin(target, eq(target.id, jobConfig.targetId))
        .where(
          and(
            eq(release.deploymentId, input),
            eq(latestCompletedJobExecution.rank, 1),
          ),
        )
        .then((r) =>
          r.map((row) => ({
            ...row.jobExecution,
            release: row.release,
            target: row.target,
            jobConfig: row.job_config,
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
        .returning()
        .then(takeFirst)
        .then((d) =>
          input.data.jobAgentConfig != null
            ? ctx.db
                .select()
                .from(deployment)
                .innerJoin(release, eq(release.deploymentId, deployment.id))
                .innerJoin(jobConfig, eq(jobConfig.releaseId, release.id))
                .leftJoin(
                  jobExecution,
                  eq(jobExecution.jobConfigId, jobConfig.id),
                )
                .where(
                  and(
                    eq(deployment.id, input.id),
                    isNull(jobExecution.jobConfigId),
                  ),
                )
                .then((jobConfigs) =>
                  dispatchJobConfigs(ctx.db)
                    .jobConfigs(jobConfigs.map((jc) => jc.job_config))
                    .filter(isPassingAllPolicies)
                    .then(cancelOldJobConfigsOnJobDispatch)
                    .dispatch()
                    .then(() => d),
                )
            : d,
        ),
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
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinctOn([deployment.id])
        .from(deployment)
        .innerJoin(system, eq(system.id, deployment.systemId))
        .innerJoin(environment, eq(environment.systemId, system.id))
        .innerJoin(
          target,
          arrayContains(target.labels, environment.targetFilter),
        )
        .leftJoin(jobConfig, eq(jobConfig.targetId, target.id))
        .leftJoin(jobExecution, eq(jobConfig.id, jobExecution.jobConfigId))
        .leftJoin(release, eq(release.id, jobConfig.releaseId))
        .where(
          and(
            eq(target.id, input),
            isNull(environment.deletedAt),
            or(
              isNull(jobExecution.id),
              inArray(jobExecution.status, [
                "completed",
                "pending",
                "in_progress",
              ]),
            ),
          ),
        )
        .orderBy(deployment.id, jobConfig.createdAt)
        .then((r) =>
          r.map((row) => ({
            ...row.deployment,
            environment: row.environment,
            system: row.system,
            jobConfig: {
              ...row.job_config,
              execution: row.job_execution,
              release: row.release,
            },
          })),
        ),
    ),

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
