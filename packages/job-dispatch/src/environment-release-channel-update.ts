import type { ReleaseCondition } from "@ctrlplane/validators/releases";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, desc, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingReleaseStringCheckPolicy } from "./policies/release-string-check.js";
import { isPassingAllPoliciesExceptNewerThanLastActive } from "./policy-checker.js";
import { createJobApprovals } from "./policy-create.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";
import { cancelOldReleaseJobTriggersOnJobDispatch } from "./release-sequencing.js";

const getReleaseFilter = (channelId: string | null) =>
  channelId != null
    ? db
        .select()
        .from(SCHEMA.releaseChannel)
        .where(eq(SCHEMA.releaseChannel.id, channelId))
        .then(takeFirstOrNull)
        .then((r) => r?.releaseFilter ?? null)
    : null;

const createFilterForExcludedReleases = (
  oldReleaseFilter: ReleaseCondition | null,
  newReleaseFilter: ReleaseCondition | null,
): ReleaseCondition | null => {
  if (oldReleaseFilter == null && newReleaseFilter == null) return null;
  if (oldReleaseFilter == null && newReleaseFilter != null)
    return {
      type: FilterType.Comparison,
      not: true,
      operator: ComparisonOperator.And,
      conditions: [newReleaseFilter],
    };
  if (oldReleaseFilter != null && newReleaseFilter == null) return null;
  if (oldReleaseFilter != null && newReleaseFilter != null)
    return {
      type: FilterType.Comparison,
      operator: ComparisonOperator.And,
      conditions: [
        {
          type: FilterType.Comparison,
          not: true,
          operator: ComparisonOperator.And,
          conditions: [newReleaseFilter],
        },
        oldReleaseFilter,
      ],
    };
  return null;
};

const cancelJobsForExcludedReleases = async (
  environmentId: string,
  deploymentId: string,
  excludedReleasesFilter: ReleaseCondition | null,
) => {
  if (excludedReleasesFilter == null) return;

  const jobsToCancel = await db
    .select()
    .from(SCHEMA.job)
    .innerJoin(
      SCHEMA.releaseJobTrigger,
      eq(SCHEMA.releaseJobTrigger.jobId, SCHEMA.job.id),
    )
    .innerJoin(
      SCHEMA.release,
      eq(SCHEMA.releaseJobTrigger.releaseId, SCHEMA.release.id),
    )
    .where(
      and(
        eq(SCHEMA.release.deploymentId, deploymentId),
        eq(SCHEMA.releaseJobTrigger.environmentId, environmentId),
        eq(SCHEMA.job.status, JobStatus.Pending),
        SCHEMA.releaseMatchesCondition(db, excludedReleasesFilter),
      ),
    )
    .then((rows) => rows.map((r) => r.job.id));

  if (jobsToCancel.length === 0) return;

  await db
    .update(SCHEMA.job)
    .set({ status: JobStatus.Cancelled })
    .where(inArray(SCHEMA.job.id, jobsToCancel));
};

const getLatestReleaseMatchingFilter = (
  deploymentId: string,
  releaseFilter: ReleaseCondition | null,
) =>
  db
    .select()
    .from(SCHEMA.release)
    .where(
      and(
        eq(SCHEMA.release.deploymentId, deploymentId),
        SCHEMA.releaseMatchesCondition(db, releaseFilter),
      ),
    )
    .orderBy(desc(SCHEMA.release.createdAt))
    .limit(1)
    .then(takeFirstOrNull);

const triggerJobsForRelease = async (
  environmentId: string,
  releaseId: string,
) => {
  const releaseJobTriggers = await createReleaseJobTriggers(
    db,
    "new_environment",
  )
    .environments([environmentId])
    .releases([releaseId])
    .filter(isPassingReleaseStringCheckPolicy)
    .then(createJobApprovals)
    .insert();

  if (releaseJobTriggers.length === 0) return;

  await dispatchReleaseJobTriggers(db)
    .releaseTriggers(releaseJobTriggers)
    .filter(isPassingAllPoliciesExceptNewerThanLastActive)
    .then(cancelOldReleaseJobTriggersOnJobDispatch)
    .dispatch();
};

const handleReleaseChannelUpdate = async (
  environmentId: string,
  deploymentId: string,
  oldChannelId: string | null,
  newChannelId: string | null,
) => {
  if (oldChannelId === newChannelId) return;

  const [oldReleaseFilter, newReleaseFilter] = await Promise.all([
    getReleaseFilter(oldChannelId),
    getReleaseFilter(newChannelId),
  ]);

  const excludedReleasesFilter = createFilterForExcludedReleases(
    oldReleaseFilter,
    newReleaseFilter,
  );

  const cancelJobsPromise = cancelJobsForExcludedReleases(
    environmentId,
    deploymentId,
    excludedReleasesFilter,
  );

  const [latestReleaseMatchingNewFilter, latestReleaseMatchingOldFilter] =
    await Promise.all([
      getLatestReleaseMatchingFilter(deploymentId, newReleaseFilter),
      getLatestReleaseMatchingFilter(deploymentId, oldReleaseFilter),
    ]);

  if (
    latestReleaseMatchingNewFilter == null ||
    latestReleaseMatchingNewFilter.id === latestReleaseMatchingOldFilter?.id
  )
    return;

  const triggerJobsPromise = triggerJobsForRelease(
    environmentId,
    latestReleaseMatchingNewFilter.id,
  );

  await Promise.all([cancelJobsPromise, triggerJobsPromise]);
};

const getPolicyReleaseChannels = (environmentId: string) =>
  db
    .select({
      deploymentId: SCHEMA.environmentPolicyReleaseChannel.deploymentId,
      channelId: SCHEMA.environmentPolicyReleaseChannel.channelId,
    })
    .from(SCHEMA.environment)
    .innerJoin(
      SCHEMA.environmentPolicy,
      eq(SCHEMA.environment.policyId, SCHEMA.environmentPolicy.id),
    )
    .innerJoin(
      SCHEMA.environmentPolicyReleaseChannel,
      eq(
        SCHEMA.environmentPolicyReleaseChannel.policyId,
        SCHEMA.environmentPolicy.id,
      ),
    )
    .where(eq(SCHEMA.environment.id, environmentId))
    .then((rows) =>
      Object.fromEntries(rows.map((r) => [r.deploymentId, r.channelId])),
    );

export const handleEnvironmentReleaseChannelUpdate = async (
  environmentId: string,
  prevReleaseChannels: Record<string, string>,
  newReleaseChannels: Record<string, string>,
) => {
  const deploymentIds = await db
    .select()
    .from(SCHEMA.environment)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deployment.systemId, SCHEMA.environment.systemId),
    )
    .where(eq(SCHEMA.environment.id, environmentId))
    .then((rows) => rows.map((r) => r.deployment.id));

  const policyReleaseChannels = await getPolicyReleaseChannels(environmentId);

  const prevReleaseChannelsWithPolicy = {
    ...policyReleaseChannels,
    ...prevReleaseChannels,
  };

  const newReleaseChannelsWithPolicy = {
    ...policyReleaseChannels,
    ...newReleaseChannels,
  };

  const releaseChannelUpdatePromises = deploymentIds.map((deploymentId) => {
    const oldChannelId = prevReleaseChannelsWithPolicy[deploymentId] ?? null;
    const newChannelId = newReleaseChannelsWithPolicy[deploymentId] ?? null;

    return handleReleaseChannelUpdate(
      environmentId,
      deploymentId,
      oldChannelId,
      newChannelId,
    );
  });

  return Promise.all(releaseChannelUpdatePromises);
};

export const handleEnvironmentPolicyReleaseChannelUpdate = async (
  policyId: string,
  prevReleaseChannels: Record<string, string>,
  newReleaseChannels: Record<string, string>,
) => {
  const environments = await db
    .select()
    .from(SCHEMA.environmentPolicy)
    .innerJoin(
      SCHEMA.environment,
      eq(SCHEMA.environmentPolicy.id, SCHEMA.environment.policyId),
    )
    .leftJoin(
      SCHEMA.environmentReleaseChannel,
      eq(SCHEMA.environmentReleaseChannel.environmentId, SCHEMA.environment.id),
    )
    .where(eq(SCHEMA.environmentPolicy.id, policyId))
    .then((rows) =>
      _.chain(rows)
        .groupBy((r) => r.environment.id)
        .map((groupedRows) => ({
          environmentId: groupedRows[0]!.environment.id,
          releaseChannels: groupedRows
            .filter((row) => isPresent(row.environment_release_channel))
            .map((row) => row.environment_release_channel!),
        }))
        .value(),
    );

  const deploymentIds = await db
    .select()
    .from(SCHEMA.environmentPolicy)
    .innerJoin(
      SCHEMA.deployment,
      eq(SCHEMA.deployment.systemId, SCHEMA.environmentPolicy.systemId),
    )
    .where(eq(SCHEMA.environmentPolicy.id, policyId))
    .then((rows) => rows.map((r) => r.deployment.id));

  const environmentReleaseChannelUpdatePromises = environments.flatMap(
    ({ environmentId, releaseChannels }) =>
      deploymentIds.map((deploymentId) => {
        const environmentLevelReleaseChannel = releaseChannels.find(
          (channel) => channel.deploymentId === deploymentId,
        );
        if (environmentLevelReleaseChannel != null) return;

        const oldChannelId = prevReleaseChannels[deploymentId] ?? null;
        const newChannelId = newReleaseChannels[deploymentId] ?? null;
        return handleReleaseChannelUpdate(
          environmentId,
          deploymentId,
          oldChannelId,
          newChannelId,
        );
      }),
  );

  return Promise.all(environmentReleaseChannelUpdatePromises);
};