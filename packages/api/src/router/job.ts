import type { Tx } from "@ctrlplane/db";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  countDistinct,
  desc,
  eq,
  isNull,
  notInArray,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  getRolloutDateForReleaseJobTrigger,
  isDateInTimeWindow,
  updateJob,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { jobCondition, JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const releaseJobTriggerQuery = (tx: Tx) =>
  tx
    .select()
    .from(schema.releaseJobTrigger)
    .innerJoin(schema.job, eq(schema.releaseJobTrigger.jobId, schema.job.id))
    .innerJoin(
      schema.resource,
      eq(schema.releaseJobTrigger.resourceId, schema.resource.id),
    )
    .innerJoin(
      schema.release,
      eq(schema.releaseJobTrigger.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.deployment,
      eq(schema.release.deploymentId, schema.deployment.id),
    )
    .innerJoin(
      schema.environment,
      eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
    )
    .innerJoin(
      schema.jobAgent,
      eq(schema.jobAgent.id, schema.deployment.jobAgentId),
    );

const processReleaseJobTriggerWithAdditionalDataRows = (
  rows: Array<{
    release_job_trigger: schema.ReleaseJobTrigger;
    job: schema.Job;
    resource: schema.Resource;
    release: schema.Release;
    deployment: schema.Deployment;
    environment: schema.Environment;
    job_agent: schema.JobAgent;
    job_metadata: schema.JobMetadata | null;
    environment_policy: schema.EnvironmentPolicy | null;
    environment_policy_release_window: schema.EnvironmentPolicyReleaseWindow | null;
    user?: schema.User | null;
    release_dependency?: schema.ReleaseDependency | null;
    deployment_name?: { deploymentName: string; deploymentId: string } | null;
    job_variable?: schema.JobVariable | null;
  }>,
) =>
  _.chain(rows)
    .groupBy((row) => row.release_job_trigger.id)
    .map((v) => ({
      ...v[0]!.release_job_trigger,
      causedBy: v[0]!.user,
      job: {
        ...v[0]!.job,
        metadata: _.chain(v)
          .map((v) => v.job_metadata)
          .filter(isPresent)
          .uniqBy((v) => v.id)
          .value(),
        status: v[0]!.job.status as JobStatus,
        variables: _.chain(v)
          .map((v) => v.job_variable)
          .filter(isPresent)
          .uniqBy((v) => v.id)
          .value(),
      },
      jobAgent: v[0]!.job_agent,
      resource: v[0]!.resource,
      release: { ...v[0]!.release, deployment: v[0]!.deployment },
      environment: v[0]!.environment,
      releaseDependencies: v
        .map((r) =>
          r.release_dependency != null
            ? {
                ...r.release_dependency,
                deploymentName: r.deployment_name!.deploymentName,
              }
            : null,
        )
        .filter(isPresent),
      rolloutDate:
        v[0]!.environment_policy != null
          ? rolloutDateFromReleaseJobTrigger(
              v[0]!.release_job_trigger.resourceId,
              v[0]!.release.id,
              v[0]!.environment.id,
              v[0]!.release.createdAt,
              v[0]!.environment_policy.rolloutDuration,
              v
                .map((r) => r.environment_policy_release_window)
                .filter(isPresent),
            )
          : null,
    }))
    .value();

const releaseJobTriggerRouter = createTRPCRouter({
  byWorkspaceId: createTRPCRouter({
    list: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          filter: jobCondition.optional(),
          limit: z.number().int().nonnegative().max(1000).default(500),
          offset: z.number().int().nonnegative().default(0),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.JobList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .query(({ ctx, input }) =>
        releaseJobTriggerQuery(ctx.db)
          .leftJoin(
            schema.system,
            eq(schema.system.id, schema.deployment.systemId),
          )
          .leftJoin(
            schema.jobMetadata,
            eq(schema.jobMetadata.jobId, schema.job.id),
          )
          .leftJoin(
            schema.jobVariable,
            eq(schema.jobVariable.jobId, schema.job.id),
          )
          .where(
            and(
              eq(schema.system.workspaceId, input.workspaceId),
              isNull(schema.resource.deletedAt),
              schema.releaseJobMatchesCondition(ctx.db, input.filter),
            ),
          )
          .orderBy(desc(schema.job.createdAt))
          .limit(input.limit)
          .offset(input.offset)
          .then((data) =>
            _.chain(data)
              .groupBy((t) => t.release_job_trigger.id)
              .map((v) => ({
                ...v[0]!.release_job_trigger,
                job: {
                  ...v[0]!.job,
                  metadata: _.chain(v)
                    .map((v) => v.job_metadata)
                    .filter(isPresent)
                    .uniqBy((v) => v.id)
                    .value(),
                  variables: _.chain(v)
                    .map((v) => v.job_variable)
                    .filter(isPresent)
                    .uniqBy((v) => v.id)
                    .value(),
                },
                jobAgent: v[0]!.job_agent,
                resource: v[0]!.resource,
                release: { ...v[0]!.release, deployment: v[0]!.deployment },
                environment: v[0]!.environment,
              }))
              .value(),
          ),
      ),
    count: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          filter: jobCondition.optional(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.JobList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .query(({ ctx, input }) =>
        ctx.db
          .select({
            count: countDistinct(schema.releaseJobTrigger.id),
          })
          .from(schema.releaseJobTrigger)
          .innerJoin(
            schema.job,
            eq(schema.releaseJobTrigger.jobId, schema.job.id),
          )
          .innerJoin(
            schema.resource,
            eq(schema.releaseJobTrigger.resourceId, schema.resource.id),
          )
          .innerJoin(
            schema.release,
            eq(schema.releaseJobTrigger.releaseId, schema.release.id),
          )
          .innerJoin(
            schema.deployment,
            eq(schema.release.deploymentId, schema.deployment.id),
          )
          .innerJoin(
            schema.environment,
            eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
          )
          .innerJoin(
            schema.system,
            eq(schema.environment.systemId, schema.system.id),
          )
          .where(
            and(
              eq(schema.system.workspaceId, input.workspaceId),
              isNull(schema.resource.deletedAt),
              schema.releaseJobMatchesCondition(ctx.db, input.filter),
            ),
          )
          .then(takeFirst)
          .then((t) => t.count),
      ),
    dailyCount: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid(), timezone: z.string() }))
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .query(async ({ ctx, input }) => {
        const dateTruncExpr = sql<Date>`date_trunc('day', ${schema.releaseJobTrigger.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE '${sql.raw(input.timezone)}')`;

        const subquery = ctx.db
          .select({
            date: dateTruncExpr.as("date"),
            status: schema.job.status,
            countPerStatus: sql<number>`COUNT(*)`.as("countPerStatus"),
          })
          .from(schema.releaseJobTrigger)
          .innerJoin(
            schema.job,
            eq(schema.releaseJobTrigger.jobId, schema.job.id),
          )
          .innerJoin(
            schema.environment,
            eq(schema.releaseJobTrigger.environmentId, schema.environment.id),
          )
          .innerJoin(
            schema.system,
            eq(schema.environment.systemId, schema.system.id),
          )
          .where(
            and(
              eq(schema.system.workspaceId, input.workspaceId),
              notInArray(schema.job.status, [
                JobStatus.Pending,
                JobStatus.Cancelled,
                JobStatus.Skipped,
              ]),
            ),
          )
          .groupBy(dateTruncExpr, schema.job.status)
          .as("sub");

        return ctx.db
          .select({
            date: subquery.date,
            totalCount: sql<number>`SUM(${subquery.countPerStatus})`.as(
              "totalCount",
            ),
            statusCounts: sql<Record<JobStatus, number>>`
              jsonb_object_agg(${subquery.status}, ${subquery.countPerStatus})
            `.as("statusCounts"),
          })
          .from(subquery)
          .groupBy(subquery.date)
          .orderBy(subquery.date);
      }),
  }),

  byDeploymentId: createTRPCRouter({
    dailyCount: protectedProcedure
      .input(
        z.object({ deploymentId: z.string().uuid(), timezone: z.string() }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.JobList)
            .on({ type: "deployment", id: input.deploymentId }),
      })
      .query(async ({ ctx, input }) => {
        const dateTruncExpr = sql<Date>`date_trunc('day', ${schema.releaseJobTrigger.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE '${sql.raw(input.timezone)}')`;

        const subquery = ctx.db
          .select({
            date: dateTruncExpr.as("date"),
            status: schema.job.status,
            countPerStatus: sql<number>`COUNT(*)`.as("countPerStatus"),
          })
          .from(schema.releaseJobTrigger)
          .innerJoin(
            schema.job,
            eq(schema.releaseJobTrigger.jobId, schema.job.id),
          )
          .innerJoin(
            schema.release,
            eq(schema.releaseJobTrigger.releaseId, schema.release.id),
          )
          .where(
            and(
              eq(schema.release.deploymentId, input.deploymentId),
              notInArray(schema.job.status, [
                JobStatus.Pending,
                JobStatus.Cancelled,
                JobStatus.Skipped,
              ]),
            ),
          )
          .groupBy(dateTruncExpr, schema.job.status)
          .as("sub");

        return ctx.db
          .select({
            date: subquery.date,
            totalCount: sql<number>`SUM(${subquery.countPerStatus})`.as(
              "totalCount",
            ),
            statusCounts: sql<Record<JobStatus, number>>`
              jsonb_object_agg(${subquery.status}, ${subquery.countPerStatus})
            `.as("statusCounts"),
          })
          .from(subquery)
          .groupBy(subquery.date)
          .orderBy(subquery.date);
      }),
  }),

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
            eq(schema.deployment.id, input.deploymentId),
            eq(schema.environment.id, input.environmentId),
            isNull(schema.resource.deletedAt),
          ),
        )
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            jobAgent: t.job_agent,
            resource: t.resource,
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
          .on({ type: "release", id: input.releaseId }),
    })
    .input(
      z.object({
        releaseId: z.string().uuid(),
        filter: jobCondition.optional(),
        limit: z.number().int().nonnegative().max(1000).default(500),
        offset: z.number().int().nonnegative().default(0),
      }),
    )
    .query(({ ctx, input }) =>
      releaseJobTriggerQuery(ctx.db)
        .leftJoin(
          schema.jobMetadata,
          eq(schema.jobMetadata.jobId, schema.job.id),
        )
        .leftJoin(
          schema.environmentPolicy,
          eq(schema.environment.policyId, schema.environmentPolicy.id),
        )
        .leftJoin(
          schema.environmentPolicyReleaseWindow,
          eq(
            schema.environmentPolicyReleaseWindow.policyId,
            schema.environmentPolicy.id,
          ),
        )
        .where(
          and(
            eq(schema.release.id, input.releaseId),
            isNull(schema.resource.deletedAt),
            schema.releaseJobMatchesCondition(ctx.db, input.filter),
          ),
        )
        .orderBy(desc(schema.releaseJobTrigger.createdAt))
        .limit(input.limit)
        .offset(input.offset)
        .then(processReleaseJobTriggerWithAdditionalDataRows),
    ),

  byId: protectedProcedure
    .input(z.string().uuid())
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.JobGet).on({ type: "job", id: input }),
    })
    .query(async ({ ctx, input }) => {
      const deploymentName = ctx.db
        .select({
          deploymentName: schema.deployment.name,
          deploymentId: schema.deployment.id,
        })
        .from(schema.deployment)
        .as("deployment_name");

      const data = await releaseJobTriggerQuery(ctx.db)
        .leftJoin(
          schema.user,
          eq(schema.releaseJobTrigger.causedById, schema.user.id),
        )
        .leftJoin(
          schema.jobMetadata,
          eq(schema.jobMetadata.jobId, schema.job.id),
        )
        .leftJoin(
          schema.jobVariable,
          eq(schema.jobVariable.jobId, schema.job.id),
        )
        .leftJoin(
          schema.environmentPolicy,
          eq(schema.environment.policyId, schema.environmentPolicy.id),
        )
        .leftJoin(
          schema.environmentPolicyReleaseWindow,
          eq(
            schema.environmentPolicyReleaseWindow.policyId,
            schema.environmentPolicy.id,
          ),
        )
        .leftJoin(
          schema.releaseDependency,
          eq(schema.releaseDependency.releaseId, schema.release.id),
        )
        .leftJoin(
          deploymentName,
          eq(
            deploymentName.deploymentId,
            schema.releaseDependency.deploymentId,
          ),
        )
        .where(and(eq(schema.job.id, input), isNull(schema.resource.deletedAt)))
        .then(processReleaseJobTriggerWithAdditionalDataRows)
        .then(takeFirst);

      return data;
    }),
});

const rolloutDateFromReleaseJobTrigger = (
  resourceId: string,
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
    [releaseId, environmentId, resourceId].join(":"),
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
  byWorkspaceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.JobAgentList)
          .on({ type: "workspace", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .select()
        .from(schema.jobAgent)
        .where(eq(schema.jobAgent.workspaceId, input)),
    ),

  create: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.JobAgentCreate)
          .on({ type: "workspace", id: input.workspaceId }),
    })
    .input(schema.createJobAgent)
    .mutation(({ ctx, input }) =>
      ctx.db.insert(schema.jobAgent).values(input).returning().then(takeFirst),
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
          .from(schema.releaseJobTrigger)
          .innerJoin(
            schema.job,
            eq(schema.job.id, schema.releaseJobTrigger.jobId),
          )
          .where(
            and(
              eq(schema.releaseJobTrigger.environmentId, input),
              eq(schema.job.status, JobStatus.Pending),
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

const metadataKeysRouter = createTRPCRouter({
  byReleaseId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.ReleaseGet)
          .on({ type: "release", id: input }),
    })
    .input(z.string().uuid())
    .query(({ ctx, input }) =>
      ctx.db
        .selectDistinct({ key: schema.jobMetadata.key })
        .from(schema.release)
        .innerJoin(
          schema.releaseJobTrigger,
          eq(schema.releaseJobTrigger.releaseId, schema.release.id),
        )
        .innerJoin(
          schema.job,
          eq(schema.releaseJobTrigger.jobId, schema.job.id),
        )
        .innerJoin(
          schema.jobMetadata,
          eq(schema.jobMetadata.jobId, schema.job.id),
        )
        .where(eq(schema.release.id, input))
        .then((r) => r.map((row) => row.key)),
    ),
});

export const jobRouter = createTRPCRouter({
  byResourceId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "resource", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      releaseJobTriggerQuery(ctx.db)
        .where(
          and(eq(schema.resource.id, input), isNull(schema.resource.deletedAt)),
        )
        .limit(1_000)
        .orderBy(
          desc(schema.job.createdAt),
          desc(schema.releaseJobTrigger.createdAt),
        )
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            agent: t.job_agent,
            resource: t.resource,
            deployment: t.deployment,
            release: { ...t.release },
            environment: t.environment,
          })),
        ),
    ),

  update: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser.perform(Permission.JobUpdate).on({ type: "job", id: input.id }),
    })
    .input(z.object({ id: z.string().uuid(), data: schema.updateJob }))
    .mutation(({ input }) => updateJob(input.id, input.data)),

  config: releaseJobTriggerRouter,
  agent: jobAgentRouter,
  trigger: jobTriggerRouter,
  metadataKey: metadataKeysRouter,
});
