import type { Tx } from "@ctrlplane/db";

import { and, desc, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { JobStatus } from "@ctrlplane/validators/jobs";

export const getDesiredVersion = async (
  db: Tx,
  environment: SCHEMA.Environment,
  deployment: SCHEMA.Deployment,
  resourceIds: string[],
) => {
  const versionChannelSelector = await db
    .select({
      versionSelector: SCHEMA.deploymentVersionChannel.versionSelector,
    })
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
        eq(SCHEMA.deploymentVersionChannel.deploymentId, deployment.id),
      ),
    )
    .then(takeFirstOrNull)
    .then((v) => v?.versionSelector ?? null);

  const desiredVersion = await db
    .select()
    .from(SCHEMA.deploymentVersion)
    .leftJoin(
      SCHEMA.environmentPolicyApproval,
      and(
        eq(SCHEMA.environmentPolicyApproval.policyId, environment.policyId),
        eq(
          SCHEMA.environmentPolicyApproval.deploymentVersionId,
          SCHEMA.deploymentVersion.id,
        ),
      ),
    )
    .where(
      and(
        eq(SCHEMA.deploymentVersion.deploymentId, deployment.id),
        SCHEMA.deploymentVersionMatchesCondition(db, versionChannelSelector),
      ),
    )
    .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
    .limit(1)
    .then(takeFirstOrNull)
    .then((v) => {
      if (v == null) return null;
      return {
        ...v.deployment_version,
        approval: v.environment_policy_approval,
      };
    });

  if (desiredVersion == null) return null;

  /**
   * This needs to be separated from the desired version query
   * because subqueries execute independently first. If combined,
   * we'd get "latest job per resource" regardless of version,
   * then filter by version, missing resources whose latest job
   * is for a different version than desired.
   */
  const jobs = await db
    .selectDistinctOn([SCHEMA.releaseJobTrigger.resourceId])
    .from(SCHEMA.releaseJobTrigger)
    .innerJoin(SCHEMA.job, eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id))
    .where(
      and(
        inArray(SCHEMA.releaseJobTrigger.resourceId, resourceIds),
        eq(SCHEMA.releaseJobTrigger.versionId, desiredVersion.id),
      ),
    )
    .orderBy(SCHEMA.releaseJobTrigger.resourceId, desc(SCHEMA.job.createdAt));

  const getDeploymentStatus = () => {
    const isPendingApproval = desiredVersion.approval?.status === "pending";
    if (isPendingApproval) return "Pending Approval";

    const isFailed = jobs.some((j) => j.job.status == JobStatus.Failure);
    if (isFailed) return "Failed";

    const isDeployed =
      jobs.every((j) => j.job.status == JobStatus.Successful) &&
      jobs.length === resourceIds.length;
    if (isDeployed) return "Deployed";

    return "Deploying";
  };

  return { ...desiredVersion, status: getDeploymentStatus() };
};
