import type { Tx } from "@ctrlplane/db";
import type { JobStatusType } from "@ctrlplane/validators/jobs";

import { and, count, desc, eq, inArray, sql, takeFirst } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

const failureStatuses: JobStatusType[] = [
  JobStatus.Failure,
  JobStatus.InvalidIntegration,
  JobStatus.InvalidJobAgent,
  JobStatus.ExternalRunNotFound,
];

const pendingStatuses: JobStatusType[] = [
  JobStatus.Pending,
  JobStatus.ActionRequired,
];

const deployedStatuses = [
  ...failureStatuses,
  ...pendingStatuses,
  JobStatus.Successful,
  JobStatus.InProgress,
];

/**
 * Get the deployment stats for a given environment and deployment.
 * @param db - The database connection.
 * @param environment - The environment to get the deployment stats for.
 * @param deployment - The deployment to get the deployment stats for.
 * @param resourceIds - The resource IDs to get the deployment stats for.
 * @returns The count of successful, in progress, pending, and failed deployments across the resources
 *  for the given environment and deployment.
 */
export const getDeploymentStats = async (
  db: Tx,
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
  resourceIds: string[],
) => {
  const deploymentResourceIds = await db
    .select({ id: SCHEMA.resource.id })
    .from(SCHEMA.resource)
    .where(
      and(
        inArray(SCHEMA.resource.id, resourceIds),
        SCHEMA.resourceMatchesMetadata(db, deployment.resourceSelector),
      ),
    )
    .then((resources) => resources.map((r) => r.id));
  const { length: numResources } = deploymentResourceIds;

  const latestJobsPerResourceAndDeploymentSubquery = db
    .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId], {
      resourceId: SCHEMA.releaseJobTrigger.resourceId,
      jobId: SCHEMA.job.id,
      status: SCHEMA.job.status,
    })
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
    .innerJoin(
      SCHEMA.resource,
      eq(SCHEMA.releaseJobTrigger.resourceId, SCHEMA.resource.id),
    )
    .innerJoin(
      SCHEMA.deploymentVersion,
      eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
    )
    .where(
      and(
        inArray(SCHEMA.releaseJobTrigger.resourceId, deploymentResourceIds),
        eq(SCHEMA.releaseJobTrigger.environmentId, environment.id),
        eq(SCHEMA.deploymentVersion.deploymentId, deployment.id),
        inArray(SCHEMA.job.status, deployedStatuses),
        SCHEMA.resourceMatchesMetadata(db, deployment.resourceSelector),
      ),
    )
    .orderBy(
      SCHEMA.releaseJobTrigger.resourceId,
      desc(SCHEMA.job.createdAt),
      desc(SCHEMA.deploymentVersion.createdAt),
    )
    .as("latest_jobs");

  const statsByJobStatus = await db
    .select({
      successful: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} = ${JobStatus.Successful} THEN 1 ELSE NULL END`,
      ),
      inProgress: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} = ${JobStatus.InProgress} THEN 1 ELSE NULL END`,
      ),
      pending: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} IN (${sql.raw(pendingStatuses.map((s) => `'${s}'`).join(", "))}) THEN 1 ELSE NULL END`,
      ),
      failed: count(
        sql`CASE WHEN ${latestJobsPerResourceAndDeploymentSubquery.status} IN (${sql.raw(failureStatuses.map((s) => `'${s}'`).join(", "))}) THEN 1 ELSE NULL END`,
      ),
    })
    .from(latestJobsPerResourceAndDeploymentSubquery)
    .then(takeFirst);

  const total = numResources;
  const { successful, inProgress, pending, failed } = statsByJobStatus;
  const notDeployed = numResources - successful - failed - inProgress - pending;

  return {
    deploymentId: deployment.id,
    total,
    successful,
    inProgress,
    pending,
    failed,
    notDeployed,
  };
};
