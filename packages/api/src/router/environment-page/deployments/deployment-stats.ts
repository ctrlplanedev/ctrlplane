import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, desc, eq, inArray, isNull, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";
import {
  analyticsStatuses,
  failedStatuses,
  JobStatus,
} from "@ctrlplane/validators/jobs";

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

export const getDeploymentStats = async (
  db: Tx,
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
  workspaceId: string,
  statusFilter?: "pending" | "failed" | "deploying" | "success",
) => {
  const versionSelector = await getVersionSelector(db, environment, deployment);

  const resourceSelector: ResourceCondition = {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [environment.resourceSelector, deployment.resourceSelector].filter(
      isPresent,
    ),
  };

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
  if (statusFilter != null && statusFilter !== status) return null;

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
