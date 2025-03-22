import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";
import { z } from "zod";

import {
  and,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Permission } from "@ctrlplane/validators/auth";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import {
  analyticsStatuses,
  failedStatuses,
  JobStatus,
} from "@ctrlplane/validators/jobs";

import { createTRPCRouter, protectedProcedure } from "../../../trpc";

const getVersionSelector = async (
  db: Tx,
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
) =>
  db
    .select()
    .from(SCHEMA.environmentPolicyDeploymentVersionChannel)
    .innerJoin(
      SCHEMA.deploymentVersionChannel,
      eq(
        SCHEMA.environmentPolicyDeploymentVersionChannel.channelId,
        SCHEMA.deploymentVersionChannel.id,
      ),
    )
    .where(
      and(
        eq(
          SCHEMA.environmentPolicyDeploymentVersionChannel.policyId,
          environment.policyId,
        ),
        eq(
          SCHEMA.environmentPolicyDeploymentVersionChannel.deploymentId,
          deployment.id,
        ),
      ),
    )
    .then(takeFirstOrNull)
    .then((row) => row?.deployment_version_channel.versionSelector ?? null);

const getStatus = (
  jobs: SCHEMA.Job[],
  approval: SCHEMA.EnvironmentPolicyApproval | null,
): "failed" | "success" | "pending" | "deploying" => {
  const isFailed = jobs.some((job) =>
    failedStatuses.includes(job.status as JobStatus),
  );
  if (isFailed) return "failed";

  if (approval != null && approval.status === "pending") return "pending";

  const isSuccess = jobs.every((job) => job.status === JobStatus.Successful);
  if (isSuccess) return "success";

  return "deploying";
};

const getDuration = (jobs: SCHEMA.Job[]) => {
  const jobsNotSkippedOrCancelled = jobs.filter(
    (job) =>
      job.status !== JobStatus.Cancelled && job.status !== JobStatus.Skipped,
  );

  const earliestStartedAt = _.minBy(
    jobsNotSkippedOrCancelled,
    (job) => job.startedAt,
  )?.startedAt;
  const latestFinishedAt = _.maxBy(
    jobsNotSkippedOrCancelled,
    (job) => job.completedAt,
  )?.completedAt;

  if (earliestStartedAt == null || latestFinishedAt == null) return 0;

  return latestFinishedAt.getTime() - earliestStartedAt.getTime();
};

const getSuccessRate = (jobs: SCHEMA.Job[]) => {
  const completedJobs = jobs.filter((job) =>
    analyticsStatuses.includes(job.status as JobStatus),
  );

  if (completedJobs.length === 0) return 0;

  const successfulJobs = completedJobs.filter(
    (job) => job.status === JobStatus.Successful,
  );

  return successfulJobs.length / completedJobs.length;
};

const getDeploymentStats = async (
  db: Tx,
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
  workspaceId: string,
) => {
  const versionSelector = await getVersionSelector(db, environment, deployment);

  const resourceSelector: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [environment.resourceFilter, deployment.resourceFilter].filter(
      isPresent,
    ),
  };

  // const latestJobsSubquery = db
  //   .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId])
  //   .from(SCHEMA.releaseJobTrigger)
  //   .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
  //   .innerJoin(
  //     SCHEMA.resource,
  //     eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
  //   )
  //   .where(
  //     and(
  //       eq(SCHEMA.releaseJobTrigger.environmentId, environment.id),
  //       isNull(SCHEMA.resource.deletedAt),
  //       SCHEMA.resourceMatchesMetadata(db, resourceSelector),
  //     ),
  //   )
  //   .orderBy(SCHEMA.releaseJobTrigger.resourceId, desc(SCHEMA.job.createdAt))
  //   .as("latestJobs");

  const row = await db
    .select()
    .from(SCHEMA.deploymentVersion)
    .leftJoin(
      SCHEMA.environmentPolicyApproval,
      and(
        eq(
          SCHEMA.environmentPolicyApproval.deploymentVersionId,
          SCHEMA.deploymentVersion.id,
        ),
        eq(SCHEMA.environmentPolicyApproval.policyId, environment.policyId),
      ),
    )
    .leftJoin(
      SCHEMA.user,
      eq(SCHEMA.environmentPolicyApproval.userId, SCHEMA.user.id),
    )
    .where(
      and(
        eq(SCHEMA.deploymentVersion.deploymentId, deployment.id),
        SCHEMA.deploymentVersionMatchesCondition(db, versionSelector),
      ),
    )
    .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  console.log({ row });

  if (row == null) return null;

  const {
    deployment_version: version,
    environment_policy_approval: approval,
    user,
  } = row;

  const resources = await db
    .select()
    .from(SCHEMA.resource)
    .where(
      and(
        eq(SCHEMA.resource.workspaceId, workspaceId),
        isNull(SCHEMA.resource.deletedAt),
        SCHEMA.resourceMatchesMetadata(db, resourceSelector),
      ),
    );

  const resourceCount = resources.length;

  const jobs = await db
    .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId])
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
    .where(
      and(
        eq(SCHEMA.releaseJobTrigger.environmentId, environment.id),
        eq(SCHEMA.releaseJobTrigger.versionId, version.id),
        inArray(
          SCHEMA.releaseJobTrigger.resourceId,
          resources.map((r) => r.id),
        ),
      ),
    )
    .orderBy(SCHEMA.releaseJobTrigger.resourceId, desc(SCHEMA.job.createdAt))
    .then((rows) => rows.map((row) => row.job));

  const status = getStatus(jobs, approval);

  const duration = getDuration(jobs);

  const successRate = getSuccessRate(jobs);

  return {
    deployment: {
      id: deployment.id,
      name: deployment.name,
      tag: version.tag,
    },
    status,
    resourceCount,
    duration,
    deployedBy: user?.name ?? null,
    successRate,
    deployedAt: version.createdAt,
  };
};

export const deploymentsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        workspaceId: z.string().uuid(),
        search: z.string().optional(),
      }),
    )
    .meta({
      authorizationCheck: ({ canUser, input }) =>
        canUser
          .perform(Permission.EnvironmentGet)
          .on({ type: "environment", id: input.environmentId }),
    })
    .query(async ({ ctx, input }) => {
      const { environmentId, workspaceId, search } = input;

      const environment = await ctx.db
        .select()
        .from(SCHEMA.environment)
        .where(eq(SCHEMA.environment.id, environmentId))
        .then(takeFirst);

      const deployments = await ctx.db
        .select()
        .from(SCHEMA.deployment)
        .where(
          and(
            eq(SCHEMA.deployment.systemId, environment.systemId),
            search != null
              ? ilike(SCHEMA.deployment.name, `%${search}%`)
              : undefined,
          ),
        );

      const deploymentStats = await Promise.all(
        deployments.map((deployment) =>
          getDeploymentStats(ctx.db, environment, deployment, workspaceId),
        ),
      ).then((stats) => stats.filter(isPresent));

      return deploymentStats;
    }),
});
