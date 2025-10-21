import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash-es";
import { isPresent } from "ts-is-present";

import { and, desc, eq, isNull, takeFirstOrNull } from "@ctrlplane/db";
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

const getStatus = (
  jobs: SCHEMA.Job[],
): "failed" | "success" | "pending" | "deploying" => {
  const isFailed = jobs.some((job) =>
    failedStatuses.includes(job.status as JobStatus),
  );
  if (isFailed) return "failed";

  const isSuccess = jobs.every((job) => job.status === JobStatus.Successful);
  if (isSuccess) return "success";

  const isDeploying = jobs.some((job) => job.status === JobStatus.InProgress);
  if (isDeploying) return "deploying";

  return "pending";
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
  const resourceSelector: ResourceCondition = {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [
      environment.resourceSelector,
      deployment.resourceSelector,
    ].filter(isPresent),
  };

  const version = await db
    .select()
    .from(SCHEMA.deploymentVersion)
    .where(and(eq(SCHEMA.deploymentVersion.deploymentId, deployment.id)))
    .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

  if (version == null) return null;

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
    .selectDistinctOn([SCHEMA.versionRelease.releaseTargetId])
    .from(SCHEMA.job)
    .innerJoin(SCHEMA.releaseJob, eq(SCHEMA.releaseJob.jobId, SCHEMA.job.id))
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.releaseJob.releaseId, SCHEMA.release.id),
    )
    .innerJoin(
      SCHEMA.versionRelease,
      eq(SCHEMA.release.versionReleaseId, SCHEMA.versionRelease.id),
    )
    .innerJoin(
      SCHEMA.releaseTarget,
      eq(SCHEMA.versionRelease.releaseTargetId, SCHEMA.releaseTarget.id),
    )
    .where(eq(SCHEMA.releaseTarget.environmentId, environment.id))
    .then((rows) => rows.map((row) => row.job));

  const status = getStatus(jobs);
  if (statusFilter != null && statusFilter !== status) return null;

  const duration = getDuration(jobs);

  const successRate = getSuccessRate(jobs);

  return {
    deployment: {
      id: deployment.id,
      name: deployment.name,
      slug: deployment.slug,
      version,
    },
    status,
    resourceCount,
    duration,
    deployedBy: null,
    successRate,
    deployedAt: version.createdAt,
  };
};
