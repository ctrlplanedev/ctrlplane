import type { Tx } from "@ctrlplane/db";
import type {
  Deployment,
  Environment,
  EnvironmentPolicy,
  EnvironmentPolicyReleaseWindow,
  Job,
  JobAgent,
  JobMetadata,
  JobVariable,
  Release,
  ReleaseDependency,
  ReleaseJobTrigger,
  Target,
  User,
} from "@ctrlplane/db/schema";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  inArray,
  notInArray,
  sql,
  takeFirst,
} from "@ctrlplane/db";
import {
  createJobAgent,
  deployment,
  environment,
  environmentPolicy,
  environmentPolicyReleaseWindow,
  job,
  jobAgent,
  jobMatchesCondition,
  jobMetadata,
  jobVariable,
  release,
  releaseDependency,
  releaseJobTrigger,
  releaseMatchesCondition,
  system,
  target,
  updateJob,
  user,
} from "@ctrlplane/db/schema";
import {
  cancelOldReleaseJobTriggersOnJobDispatch,
  dispatchReleaseJobTriggers,
  getRolloutDateForReleaseJobTrigger,
  isDateInTimeWindow,
  onJobCompletion,
} from "@ctrlplane/job-dispatch";
import { Permission } from "@ctrlplane/validators/auth";
import { jobCondition, JobStatus } from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const releaseJobTriggerQuery = (tx: Tx) =>
  tx
    .select()
    .from(releaseJobTrigger)
    .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
    .innerJoin(target, eq(releaseJobTrigger.targetId, target.id))
    .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
    .innerJoin(deployment, eq(release.deploymentId, deployment.id))
    .innerJoin(environment, eq(releaseJobTrigger.environmentId, environment.id))
    .innerJoin(jobAgent, eq(jobAgent.id, deployment.jobAgentId));

const processReleaseJobTriggerWithAdditionalDataRows = (
  rows: Array<{
    release_job_trigger: ReleaseJobTrigger;
    job: Job;
    resource: Target;
    release: Release;
    deployment: Deployment;
    environment: Environment;
    job_agent: JobAgent;
    job_metadata: JobMetadata | null;
    environment_policy: EnvironmentPolicy | null;
    environment_policy_release_window: EnvironmentPolicyReleaseWindow | null;
    user?: User | null;
    release_dependency?: ReleaseDependency | null;
    deployment_name?: { deploymentName: string; deploymentId: string } | null;
    job_variable?: JobVariable | null;
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
      target: v[0]!.resource,
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
              v[0]!.release_job_trigger.targetId,
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
      .query(async ({ ctx, input }) => {
        const items = await releaseJobTriggerQuery(ctx.db)
          .leftJoin(system, eq(system.id, deployment.systemId))
          .where(
            and(
              eq(system.workspaceId, input.workspaceId),
              jobMatchesCondition(ctx.db, input.filter),
            ),
          )
          .orderBy(asc(releaseJobTrigger.createdAt))
          .limit(input.limit)
          .offset(input.offset)
          .then((data) =>
            data.map((t) => ({
              ...t.release_job_trigger,
              job: t.job,
              agent: t.job_agent,
              target: t.resource,
              release: { ...t.release, deployment: t.deployment },
              environment: t.environment,
            })),
          );

        const total = await ctx.db
          .select({
            count: countDistinct(releaseJobTrigger.id),
          })
          .from(releaseJobTrigger)
          .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
          .innerJoin(target, eq(releaseJobTrigger.targetId, target.id))
          .innerJoin(release, eq(releaseJobTrigger.releaseId, release.id))
          .innerJoin(deployment, eq(release.deploymentId, deployment.id))
          .innerJoin(
            environment,
            eq(releaseJobTrigger.environmentId, environment.id),
          )
          .innerJoin(system, eq(environment.systemId, system.id))
          .where(
            and(
              eq(system.workspaceId, input.workspaceId),
              jobMatchesCondition(ctx.db, input.filter),
            ),
          )
          .then(takeFirst)
          .then((t) => t.count);

        return { items, total };
      }),
    dailyCount: protectedProcedure
      .input(
        z.object({
          workspaceId: z.string().uuid(),
          timezone: z.string(),
        }),
      )
      .meta({
        authorizationCheck: ({ canUser, input }) =>
          canUser
            .perform(Permission.SystemList)
            .on({ type: "workspace", id: input.workspaceId }),
      })
      .query(async ({ ctx, input }) => {
        const dateTruncExpr = sql<Date>`date_trunc('day', ${releaseJobTrigger.createdAt} AT TIME ZONE 'UTC' AT TIME ZONE '${sql.raw(input.timezone)}')`;

        const subquery = ctx.db
          .select({
            date: dateTruncExpr.as("date"),
            status: job.status,
            countPerStatus: sql<number>`COUNT(*)`.as("countPerStatus"),
          })
          .from(releaseJobTrigger)
          .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
          .innerJoin(
            environment,
            eq(releaseJobTrigger.environmentId, environment.id),
          )
          .innerJoin(system, eq(environment.systemId, system.id))
          .where(
            and(
              eq(system.workspaceId, input.workspaceId),
              notInArray(job.status, [
                JobStatus.Pending,
                JobStatus.Cancelled,
                JobStatus.Skipped,
              ]),
            ),
          )
          .groupBy(dateTruncExpr, job.status)
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
            eq(deployment.id, input.deploymentId),
            eq(environment.id, input.environmentId),
          ),
        )
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            jobAgent: t.job_agent,
            target: t.resource,
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
        .leftJoin(jobMetadata, eq(jobMetadata.jobId, job.id))
        .leftJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .where(
          and(
            eq(release.id, input.releaseId),
            jobMatchesCondition(ctx.db, input.filter),
          ),
        )
        .orderBy(desc(releaseJobTrigger.createdAt))
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
          deploymentName: deployment.name,
          deploymentId: deployment.id,
        })
        .from(deployment)
        .as("deployment_name");

      const data = await releaseJobTriggerQuery(ctx.db)
        .leftJoin(user, eq(releaseJobTrigger.causedById, user.id))
        .leftJoin(jobMetadata, eq(jobMetadata.jobId, job.id))
        .leftJoin(jobVariable, eq(jobVariable.jobId, job.id))
        .leftJoin(
          environmentPolicy,
          eq(environment.policyId, environmentPolicy.id),
        )
        .leftJoin(
          environmentPolicyReleaseWindow,
          eq(environmentPolicyReleaseWindow.policyId, environmentPolicy.id),
        )
        .leftJoin(
          releaseDependency,
          eq(releaseDependency.releaseId, release.id),
        )
        .leftJoin(
          deploymentName,
          eq(deploymentName.deploymentId, releaseDependency.deploymentId),
        )
        .where(eq(job.id, input))
        .then(processReleaseJobTriggerWithAdditionalDataRows)
        .then(takeFirst);

      const { releaseDependencies } = data;

      const results = await ctx.db.execute(
        sql`
          WITH RECURSIVE reachable_relationships(id, visited, tr_id, source_id, target_id, type) AS (
            -- Base case: start with the given ID and no relationship
            SELECT 
                ${data.target.id}::uuid AS id, 
                ARRAY[${data.target.id}::uuid] AS visited,
                NULL::uuid AS tr_id,
                NULL::uuid AS source_id,
                NULL::uuid AS target_id,
                NULL::target_relationship_type AS type
            UNION ALL
            -- Recursive case: find all relationships connected to the current set of IDs
            SELECT
                CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END AS id,
                rr.visited || CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END,
                tr.id AS tr_id,
                tr.source_id,
                tr.target_id,
                tr.type
            FROM reachable_relationships rr
            JOIN target_relationship tr ON tr.source_id = rr.id OR tr.target_id = rr.id
            WHERE
                NOT CASE
                    WHEN tr.source_id = rr.id THEN tr.target_id
                    ELSE tr.source_id
                END = ANY(rr.visited)                
                AND tr.target_id != ${data.target.id}
        )
        SELECT DISTINCT tr_id AS id, source_id, target_id, type
        FROM reachable_relationships
        WHERE tr_id IS NOT NULL;
        `,
      );

      // db.execute does not return the types even if the sql`` is annotated with the type
      // so we need to cast them here
      const relationships = results.rows.map((r) => ({
        id: String(r.id),
        sourceId: String(r.source_id),
        targetId: String(r.target_id),
        type: r.type as "associated_with" | "depends_on",
      }));

      const sourceIds = relationships.map((r) => r.sourceId);
      const targetIds = relationships.map((r) => r.targetId);

      const allIds = _.uniq([...sourceIds, ...targetIds, data.target.id]);

      const targets = await ctx.db
        .select()
        .from(target)
        .where(inArray(target.id, allIds));

      const releaseDependenciesWithTargetPromises = releaseDependencies.map(
        async (rd) => {
          const latestJobSubquery = ctx.db
            .select({
              id: releaseJobTrigger.id,
              targetId: releaseJobTrigger.targetId,
              releaseId: releaseJobTrigger.releaseId,
              status: job.status,
              createdAt: job.createdAt,
              rank: sql<number>`ROW_NUMBER() OVER (
              PARTITION BY ${releaseJobTrigger.targetId}, ${releaseJobTrigger.releaseId}
              ORDER BY ${job.createdAt} DESC
            )`.as("rank"),
            })
            .from(job)
            .innerJoin(releaseJobTrigger, eq(releaseJobTrigger.jobId, job.id))
            .as("latest_job");

          const targetFulfillingDependency = await ctx.db
            .select()
            .from(release)
            .innerJoin(deployment, eq(release.deploymentId, deployment.id))
            .innerJoin(
              latestJobSubquery,
              eq(latestJobSubquery.releaseId, release.id),
            )
            .where(
              and(
                releaseMatchesCondition(ctx.db, rd.releaseFilter),
                eq(deployment.id, rd.deploymentId),
                inArray(latestJobSubquery.targetId, allIds),
                eq(latestJobSubquery.rank, 1),
                eq(latestJobSubquery.status, JobStatus.Completed),
              ),
            );

          return {
            ...rd,
            target: targetFulfillingDependency.at(0)?.latest_job.targetId,
          };
        },
      );

      return {
        ...data,
        releaseDependencies: await Promise.all(
          releaseDependenciesWithTargetPromises,
        ),
        relationships,
        relatedTargets: targets,
      };
    }),
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
        .selectDistinct({ key: jobMetadata.key })
        .from(release)
        .innerJoin(
          releaseJobTrigger,
          eq(releaseJobTrigger.releaseId, release.id),
        )
        .innerJoin(job, eq(releaseJobTrigger.jobId, job.id))
        .innerJoin(jobMetadata, eq(jobMetadata.jobId, job.id))
        .where(eq(release.id, input))
        .then((r) => r.map((row) => row.key)),
    ),
});

export const jobRouter = createTRPCRouter({
  byTargetId: protectedProcedure
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.SystemList)
          .on({ type: "resource", id: input }),
    })
    .input(z.string())
    .query(({ ctx, input }) =>
      releaseJobTriggerQuery(ctx.db)
        .where(eq(target.id, input))
        .limit(1_000)
        .orderBy(desc(job.createdAt), desc(releaseJobTrigger.createdAt))
        .then((data) =>
          data.map((t) => ({
            ...t.release_job_trigger,
            job: t.job,
            agent: t.job_agent,
            target: t.resource,
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
    .input(z.object({ id: z.string().uuid(), data: updateJob }))
    .mutation(({ ctx, input }) =>
      ctx.db
        .update(job)
        .set(input.data)
        .where(eq(job.id, input.id))
        .returning()
        .then(takeFirst)
        .then((job) => {
          if (
            input.data.status === JobStatus.Completed &&
            job.status === JobStatus.Completed
          )
            onJobCompletion(job);
          return job;
        }),
    ),

  config: releaseJobTriggerRouter,
  agent: jobAgentRouter,
  trigger: jobTriggerRouter,
  metadataKey: metadataKeysRouter,
});
