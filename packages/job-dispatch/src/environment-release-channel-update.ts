import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";

import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  ComparisonOperator,
  SelectorType,
} from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { updateJob } from "./job-update.js";
import { isPassingChannelSelectorPolicy } from "./policies/release-string-check.js";
import { isPassingAllPoliciesExceptNewerThanLastActive } from "./policy-checker.js";
import { createJobApprovals } from "./policy-create.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";
import { cancelOldReleaseJobTriggersOnJobDispatch } from "./release-sequencing.js";

const getVersionSelector = (channelId: string | null) =>
  channelId != null
    ? db
        .select()
        .from(SCHEMA.deploymentVersionChannel)
        .where(eq(SCHEMA.deploymentVersionChannel.id, channelId))
        .then(takeFirstOrNull)
        .then((r) => r?.versionSelector ?? null)
    : null;

const createSelectorForExcludedVersions = (
  oldVersionSelector: DeploymentVersionCondition | null,
  newVersionSelector: DeploymentVersionCondition | null,
): DeploymentVersionCondition | null => {
  if (oldVersionSelector == null && newVersionSelector == null) return null;
  if (oldVersionSelector == null && newVersionSelector != null)
    return {
      type: SelectorType.Comparison,
      not: true,
      operator: ComparisonOperator.And,
      conditions: [newVersionSelector],
    };
  if (oldVersionSelector != null && newVersionSelector == null) return null;
  if (oldVersionSelector != null && newVersionSelector != null)
    return {
      type: SelectorType.Comparison,
      operator: ComparisonOperator.And,
      conditions: [
        {
          type: SelectorType.Comparison,
          not: true,
          operator: ComparisonOperator.And,
          conditions: [newVersionSelector],
        },
        oldVersionSelector,
      ],
    };
  return null;
};

const cancelJobsForExcludedVersions = async (
  environmentId: string,
  deploymentId: string,
  excludedVersionsSelector: DeploymentVersionCondition | null,
) => {
  if (excludedVersionsSelector == null) return;

  const jobsToCancel = await db
    .select()
    .from(SCHEMA.job)
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
    )
    .innerJoin(
      SCHEMA.deploymentVersion,
      eq(SCHEMA.releaseJobTrigger.versionId, SCHEMA.deploymentVersion.id),
    )
    .where(
      and(
        eq(SCHEMA.deploymentVersion.deploymentId, deploymentId),
        eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
        eq(SCHEMA.job.status, JobStatus.Pending),
        SCHEMA.deploymentVersionMatchesCondition(db, excludedVersionsSelector),
      ),
    )
    .then((rows) => rows.map((r) => r.job.id));

  if (jobsToCancel.length === 0) return;

  await Promise.all(
    jobsToCancel.map((jobId) =>
      updateJob(db, jobId, { status: JobStatus.Cancelled }),
    ),
  );
};

const getLatestVersionFromSelector = (
  deploymentId: string,
  versionSelector: DeploymentVersionCondition | null,
) =>
  db
    .select()
    .from(SCHEMA.deploymentVersion)
    .where(
      and(
        eq(SCHEMA.deploymentVersion.deploymentId, deploymentId),
        SCHEMA.deploymentVersionMatchesCondition(db, versionSelector),
      ),
    )
    .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

const triggerJobsForVersion = async (
  environmentId: string,
  versionId: string,
) => {
  const releaseJobTriggers = await createReleaseJobTriggers(
    db,
    "new_environment",
  )
    .environments([environmentId])
    .versions([versionId])
    .filter(isPassingChannelSelectorPolicy)
    .then(createJobApprovals)
    .insert();

  if (releaseJobTriggers.length === 0) return;

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPoliciesExceptNewerThanLastActive)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};

const handleVersionChannelUpdate = async (
  environmentId: string,
  deploymentId: string,
  oldChannelId: string | null,
  newChannelId: string | null,
) => {
  if (oldChannelId === newChannelId) return;

  const [oldVersionSelector, newVersionSelector] = await Promise.all([
    getVersionSelector(oldChannelId),
    getVersionSelector(newChannelId),
  ]);

  const excludedVersionsSelector = createSelectorForExcludedVersions(
    oldVersionSelector,
    newVersionSelector,
  );

  const cancelJobsPromise = cancelJobsForExcludedVersions(
    environmentId,
    deploymentId,
    excludedVersionsSelector,
  );

  const [latestVersionMatchingNewSelector, latestVersionMatchingOldSelector] =
    await Promise.all([
      getLatestVersionFromSelector(deploymentId, newVersionSelector),
      getLatestVersionFromSelector(deploymentId, oldVersionSelector),
    ]);

  if (
    latestVersionMatchingNewSelector == null ||
    latestVersionMatchingNewSelector.id === latestVersionMatchingOldSelector?.id
  )
    return;

  const triggerJobsPromise = triggerJobsForVersion(
    environmentId,
    latestVersionMatchingNewSelector.id,
  );

  await Promise.all([cancelJobsPromise, triggerJobsPromise]);
};

export const handleEnvironmentPolicyVersionChannelUpdate = async (
  policyId: string,
  prevVersionChannels: Record<string, string>,
  newVersionChannels: Record<string, string>,
) => {
  const environments = await db
    .select()
    .from(SCHEMA.environmentPolicy)
    .innerJoin(
      SCHEMA.environment,
      eq(SCHEMA.environmentPolicy.id, SCHEMA.environment.policyId),
    )
    .where(eq(SCHEMA.environmentPolicy.id, policyId));

  const deploymentIds = await db
    .select()
    .from(SCHEMA.environmentPolicy)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deployment.systemId, SCHEMA.environmentPolicy.systemId),
    )
    .where(eq(SCHEMA.environmentPolicy.id, policyId))
    .then((rows) => rows.map((r) => r.deployment.id));

  const environmentVersionChannelUpdatePromises = environments.flatMap(
    ({ environment }) =>
      deploymentIds.map((deploymentId) => {
        const oldChannelId = prevVersionChannels[deploymentId] ?? null;
        const newChannelId = newVersionChannels[deploymentId] ?? null;
        return handleVersionChannelUpdate(
          environment.id,
          deploymentId,
          oldChannelId,
          newChannelId,
        );
      }),
  );

  return Promise.all(environmentVersionChannelUpdatePromises);
};
