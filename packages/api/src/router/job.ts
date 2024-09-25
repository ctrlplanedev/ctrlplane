import type { Tx } from "@ctrlplane/db";
import { chain, min } from "lodash-es";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import { and, asc, desc, eq, isNull, takeFirst } from "@ctrlplane/db";
import {
  createJobAgent,
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyReleaseWindow,
  job,
  jobAgent,
  release,
  releaseJobTrigger,
  system,
  target,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  getRolloutDateForReleaseJobTrigger,
  isDateInTimeWindow,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const releaseJobTriggerQuery = (tx: Tx) =>
  tx
    .select()
    .from(releaseJobTrigger)
    .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
    .leftJoin(target, eq(releaseJobTrigger.targetId, target.id))
    .leftJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .leftJoin(deployment, eq(release.deploymentId, deployment.id))
    .leftJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(jobAgent, eq(jobAgent.id, deployment.jobAgentId));

const releaseJobTriggerRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "workspace", id: input }),
    })
    .query(({ ctx, input }) =>
      releaseJobTriggerQuery(ctx.db)
        .leftJoin(system, eq(system.id, deployment.systemId))
        .where(
          and(eq(system.workspaceId, input), isNull(environment.deletedAt)),
        )
        .orderBy(asc(releaseJobTrigger.createdAt))
        .limit(1_000)
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            agent: t.job_agent,
            target: t.target,
            release: { ...t.release, deployment: t.deployment },
            environment: t.environment,
          })),
        ),
    ),

  byDeploymentAndEnvironment: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.DeploymentGet, Permission.SystemGet)
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
      releaseJobTriggerQuery(ctx.db)
        .where(
          and(
            eq(deployment.id, input.deploymentId),
            eq(environment.id, input.environmentId),
            isNull(environment.deletedAt),
          ),
        )
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            jobAgent: t.job_agent,
            target: t.target,
            release: { ...t.release, deployment: t.deployment },
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
      releaseJobTriggerQuery(ctx.db)
        .where(and(eq(deployment.id, input), isNull(environment.deletedAt)))
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            jobAgent: t.job_agent,
            target: t.target,
            release: { ...t.release, deployment: t.deployment },
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
      releaseJobTriggerQuery(ctx.db)
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
          chain(data)
            .groupBy((row) => row.release_job_trigger.id)
            .map((v) => ({
              ...v[0]!.release_job_trigger,
              job: v[0]!.job,
              jobAgent: v[0]!.job_agent,
              target: v[0]!.target,
              release: { ...v[0]!.release, deployment: v[0]!.deployment },
              environment: v[0]!.environment,
              rolloutDate:
                v[0]!.environment_policy == null ||
                v[0]!.release == null ||
                v[0]!.environment == null
                  ? null
                  : rolloutDateFromReleaseJobTrigger(
                      v[0]!.release_job_trigger.targetId,
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

const rolloutDateFromReleaseJobTrigger = (
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
  const rolloutDate = getRolloutDateForReleaseJobTrigger(
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

    adjustedRolloutDate = min([adjustedRolloutDate, nextIntervalStart])!;
  }

  return adjustedRolloutDate;
};

const jobAgentRouter = createTRPCRouter({
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.JobAgentList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db.select().from(jobAgent).where(eq(jobAgent.workspaceId, input)),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.JobAgentCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(createJobAgent)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(jobAgent).values(input).returning().then(takeFirst),
    ),
});

const jobTriggerRouter = createTRPCRouter({
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
          .from(releaseJobTrigger)
          .innerJoin(job, eq(job.id, releaseJobTrigger.jobId))
          .where(
            and(
              eq(releaseJobTrigger.environmentId, input),
              eq(job.status, JobStatus.Pending),
            ),
          )
          .then((jcs) =>
            dispatchReleaseJobTriggers(ctx.db)
              .releaseTriggers(jcs.map((jc) => jc.release_job_trigger))
              .then(cancelOldReleaseJobTriggersOnJobDispatch)
              .dispatch(),
          ),
      ),
  }),
});

export const jobRouter = createTRPCRouter({
  byTargetId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "target", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      releaseJobTriggerQuery(ctx.db)
        .where(and(eq(target.id, input), isNull(environment.deletedAt)))
        .limit(1_000)
        .orderBy(desc(job.createdAt), desc(releaseJobTrigger.createdAt))
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            agent: t.job_agent,
            target: t.target,
            deployment: t.deployment,
            release: { ...t.release },
            environment: t.environment,
          })),
        ),
    ),

  config: releaseJobTriggerRouter,
  agent: jobAgentRouter,
  trigger: jobTriggerRouter,
});
