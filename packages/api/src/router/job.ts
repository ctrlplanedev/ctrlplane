import type { Tx } from "@ctrlplane/db";
import type { JobExecutionStatus } from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  desc,
  eq,
  isNull,
  notInArray,
  or,
  takeFirst,
} from "@ctrlplane/db";
import {
  createJobAgent,
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyReleaseWindow,
  jobAgent,
  jobConfig,
  jobExecution,
  release,
  runbook,
  system,
  target,
} from "@ctrlplane/db/schema";
import {
  cancelOldJobConfigsOnJobDispatch,
  dispatchJobConfigs,
  getRolloutDateForJobConfig,
  isDateInTimeWindow,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";

import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";

const jobConfigQuery = (tx: Tx) =>
  tx
    .select()
    .from(jobConfig)
    .leftJoin(jobExecution, eq(jobExecution.jobConfigId, jobConfig.id))
    .leftJoin(target, eq(jobConfig.targetId, target.id))
    .leftJoin(release, eq(jobConfig.releaseId, release.id))
    .leftJoin(runbook, eq(jobConfig.runbookId, runbook.id))
    .leftJoin(deployment, eq(release.deploymentId, deployment.id))
    .leftJoin(environment, eq(jobConfig.environmentId, environment.id))
    .innerJoin(
      jobAgent,
      or(
        eq(jobAgent.id, deployment.jobAgentId),
        eq(jobAgent.id, runbook.jobAgentId),
      ),
    );

const jobConfigRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "workspace", id: input }),
    })
    .query(({ ctx, input }) =>
      jobConfigQuery(ctx.db)
        .leftJoin(system, eq(system.id, deployment.systemId))
        .where(
          and(eq(system.workspaceId, input), isNull(environment.deletedAt)),
        )
        .orderBy(asc(jobConfig.createdAt))
        .limit(1_000)
        .then((data) =>
          data.map((t) => ({
            ...t.job_config,
            execution: t.job_execution,
            agent: t.job_agent,
            target: t.target,
            release: { ...t.release, deployment: t.deployment },
            runbook: t.runbook,
            environment: t.environment,
          })),
        ),
    ),

  byDeploymentAndEnvironment: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on(
            { type: "deployment", id: input.deploymentId },
            { type: "environment", id: input.environmentId },
          ),
    })
    .input(
      z.object({
        deploymentId: z.string().uuid(),
        environmentId: z.string().uuid(),
      }),
    )
    .query(({ ctx, input }) =>
      jobConfigQuery(ctx.db)
        .where(
          and(
            eq(deployment.id, input.deploymentId),
            eq(environment.id, input.environmentId),
            isNull(environment.deletedAt),
          ),
        )
        .then((data) =>
          data.map((t) => ({
            ...t.job_config,
            jobExecution: t.job_execution,
            jobAgent: t.job_agent,
            target: t.target,
            release: { ...t.release, deployment: t.deployment },
            runbook: t.runbook,
            environment: t.environment,
          })),
        ),
    ),

  byDeploymentId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "deployment", id: input }),
    })
    .query(({ ctx, input }) =>
      jobConfigQuery(ctx.db)
        .where(and(eq(deployment.id, input), isNull(environment.deletedAt)))
        .then((data) =>
          data.map((t) => ({
            ...t.job_config,
            jobExecution: t.job_execution,
            jobAgent: t.job_agent,
            target: t.target,
            release: { ...t.release, deployment: t.deployment },
            runbook: t.runbook,
            environment: t.environment,
          })),
        ),
    ),

  byReleaseId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet)
          .on({ type: "release", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      jobConfigQuery(ctx.db)
        .leftJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .where(and(eq(release.id, input), isNull(environment.deletedAt)))
        .then((data) =>
          _.chain(data)
            .groupBy("job_config.id")
            .map((v) => ({
              ...v[0]!.job_config,
              jobExecution: v[0]!.job_execution,
              jobAgent: v[0]!.job_agent,
              target: v[0]!.target,
              release: { ...v[0]!.release, deployment: v[0]!.deployment },
              runbook: v[0]!.runbook,
              environment: v[0]!.environment,
              rolloutDate:
                v[0]!.job_config.targetId == null ||
                v[0]!.environment_policy == null ||
                v[0]!.release == null ||
                v[0]!.environment == null
                  ? null
                  : rolloutDateFromJobConfig(
                      v[0]!.job_config.targetId,
                      v[0]!.release.id,
                      v[0]!.environment.id,
                      v[0]!.release.createdAt,
                      v[0]!.environment_policy.duration,
                      v
                        .map((r) => r.environment_policy_release_window)
                        .filter(isPresent),
                    ),
            }))
            .value(),
        ),
    ),
});

const rolloutDateFromJobConfig = (
  targetId: string,
  releaseId: string,
  environmentId: string,
  releaseCreatedAt: Date,
  environmentPolicyDuration: number,
  releaseWindows: Array<{
    startTime: Date;
    endTime: Date;
    recurrence: string;
  }>,
) => {
  const rolloutDate = getRolloutDateForJobConfig(
    [releaseId, environmentId, targetId].join(":"),
    releaseCreatedAt,
    environmentPolicyDuration,
  );

  if (releaseWindows.length === 0) return rolloutDate;

  const maxDate = new Date(8.64e15);
  let adjustedRolloutDate = maxDate;

  for (const window of releaseWindows) {
    const { isInWindow, nextIntervalStart } = isDateInTimeWindow(
      rolloutDate,
      window.startTime,
      window.endTime,
      window.recurrence,
    );

    if (isInWindow) return rolloutDate;

    adjustedRolloutDate = _.min([adjustedRolloutDate, nextIntervalStart])!;
  }

  return adjustedRolloutDate;
};

const jobAgentRouter = createTRPCRouter({
  byWorkspaceId: publicProcedure
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.select().from(jobAgent).where(eq(jobAgent.workspaceId, input)),
    ),
  byType: publicProcedure
    .input(z.string())
    .query(({ ctx, input }) =>
      ctx.db.select().from(jobAgent).where(eq(jobAgent.type, input)),
    ),
  create: protectedProcedure
    .input(createJobAgent)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(jobAgent).values(input).returning().then(takeFirst),
    ),
});

const jobExecutionRouter = createTRPCRouter({
  list: createTRPCRouter({
    byAgentId: publicProcedure
      .input(z.string().uuid())
      .query(({ ctx, input }) =>
        ctx.db
          .select()
          .from(jobExecution)
          .innerJoin(jobConfig, eq(jobConfig.id, jobExecution.jobConfigId))
          .leftJoin(environment, eq(environment.id, jobConfig.environmentId))
          .leftJoin(runbook, eq(runbook.id, jobConfig.runbookId))
          .leftJoin(target, eq(target.id, jobConfig.targetId))
          .leftJoin(release, eq(release.id, jobConfig.releaseId))
          .leftJoin(deployment, eq(deployment.id, release.deploymentId))
          .where(
            and(
              eq(jobExecution.jobAgentId, input),
              notInArray(jobExecution.status, [
                "failure",
                "cancelled",
                "skipped",
                "completed",
              ]),
              isNull(environment.deletedAt),
            ),
          )
          .then((r) =>
            r.map((row) => ({
              ...row.job_execution,
              config: row.job_config,
              environment: row.environment,
              runbook: row.runbook,
              target: row.target,
              release: { ...row.release, deployment: row.deployment },
            })),
          ),
      ),
  }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          status: z.string() as z.ZodType<JobExecutionStatus>,
          externalRunId: z.string().optional(),
        }),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(jobExecution)
        .set(input.data)
        .where(eq(jobExecution.id, input.id))
        .returning()
        .then(takeFirst),
    ),

  create: createTRPCRouter({
    byEnvId: protectedProcedure
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.DeploymentUpdate)
            .on({ type: "environment", id: input }),
      })
      .input(z.string().uuid())
      .mutation(({ ctx, input }) =>
        ctx.db
          .select()
          .from(jobConfig)
          .leftJoin(jobExecution, eq(jobExecution.jobConfigId, jobConfig.id))
          .where(
            and(eq(jobConfig.environmentId, input), isNull(jobExecution.id)),
          )
          .then((jcs) =>
            dispatchJobConfigs(ctx.db)
              .jobConfigs(jcs.map((jc) => jc.job_config))
              .reason("env_policy_override")
              .then(cancelOldJobConfigsOnJobDispatch)
              .dispatch(),
          ),
      ),
  }),
});

export const jobRouter = createTRPCRouter({
  byTargetId: protectedProcedure.input(z.string()).query(({ ctx, input }) =>
    jobConfigQuery(ctx.db)
      .where(and(eq(target.id, input), isNull(environment.deletedAt)))
      .limit(1_000)
      .orderBy(desc(jobExecution.createdAt), desc(jobConfig.createdAt))
      .then((data) =>
        data.map((t) => ({
          ...t.job_config,
          execution: t.job_execution,
          agent: t.job_agent,
          target: t.target,
          deployment: t.deployment,
          release: { ...t.release },
          runbook: t.runbook,
          environment: t.environment,
        })),
      ),
  ),

  config: jobConfigRouter,
  agent: jobAgentRouter,
  execution: jobExecutionRouter,
});
