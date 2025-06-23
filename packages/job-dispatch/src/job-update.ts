import type { Tx } from "@ctrlplane/db";

import {
  and,
  count,
  desc,
  eq,
  inArray,
  ne,
  sql,
  takeFirst,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { dispatchQueueJob } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import {
  exitedStatus,
  failedStatuses,
  JobStatus,
} from "@ctrlplane/validators/jobs";

const log = logger.child({ module: "job-update" });

const updateJobMetadata = async (
  jobId: string,
  existingMetadata: schema.JobMetadata[],
  metadata: Record<string, any>,
) => {
  const { [ReservedMetadataKey.Links]: links, ...remainingMetadata } = metadata;

  if (links != null) {
    const updatedLinks = JSON.stringify({
      ...JSON.parse(
        existingMetadata.find(
          (m) => m.key === String(ReservedMetadataKey.Links),
        )?.value ?? "{}",
      ),
      ...links,
    });

    await db
      .insert(schema.jobMetadata)
      .values({ jobId, key: ReservedMetadataKey.Links, value: updatedLinks })
      .onConflictDoUpdate({
        target: [schema.jobMetadata.jobId, schema.jobMetadata.key],
        set: { value: updatedLinks },
      });
  }

  if (Object.keys(remainingMetadata).length > 0)
    await db
      .insert(schema.jobMetadata)
      .values(
        Object.entries(remainingMetadata).map(([key, value]) => ({
          jobId,
          key,
          value: JSON.stringify(value),
        })),
      )
      .onConflictDoUpdate({
        target: [schema.jobMetadata.jobId, schema.jobMetadata.key],
        set: { value: sql`excluded.value` },
      });
};

const getStartedAt = (
  jobBeforeUpdate: schema.Job,
  updates: schema.UpdateJob,
) => {
  if (updates.startedAt != null) return updates.startedAt;
  if (jobBeforeUpdate.startedAt != null) return jobBeforeUpdate.startedAt;
  const isPreviousStatusPending = jobBeforeUpdate.status === JobStatus.Pending;
  const isCurrentStatusPending = updates.status === JobStatus.Pending;
  if (isPreviousStatusPending && !isCurrentStatusPending) return new Date();
  return null;
};

const getCompletedAt = (
  jobBeforeUpdate: schema.Job,
  updates: schema.UpdateJob,
) => {
  if (updates.completedAt != null) return updates.completedAt;
  if (jobBeforeUpdate.completedAt != null) return jobBeforeUpdate.completedAt;
  const isPreviousStatusExited = exitedStatus.includes(
    jobBeforeUpdate.status as JobStatus,
  );
  const isCurrentStatusExited =
    updates.status != null &&
    exitedStatus.includes(updates.status as JobStatus);

  if (!isPreviousStatusExited && isCurrentStatusExited) return new Date();
  return null;
};

const dbUpdateJob = async (
  db: Tx,
  jobId: string,
  jobBeforeUpdate: schema.Job,
  data: schema.UpdateJob,
) => {
  const startedAt = getStartedAt(jobBeforeUpdate, data);
  const completedAt = getCompletedAt(jobBeforeUpdate, data);
  const updates = { ...data, startedAt, completedAt };

  return db
    .update(schema.job)
    .set(updates)
    .where(eq(schema.job.id, jobId))
    .returning()
    .then(takeFirst);
};

const getIsJobJustCompleted = (
  previousStatus: JobStatus,
  newStatus: JobStatus,
) => {
  const isPreviousStatusExited = exitedStatus.includes(previousStatus);
  const isNewStatusExited = exitedStatus.includes(newStatus);
  return !isPreviousStatusExited && isNewStatusExited;
};

const getReleaseTarget = (db: Tx, jobId: string) =>
  db
    .select()
    .from(schema.releaseJob)
    .innerJoin(
      schema.release,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.releaseTarget,
      eq(schema.versionRelease.releaseTargetId, schema.releaseTarget.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirstOrNull)
    .then((row) => row?.release_target ?? null);

const getMatchedPolicies = async (
  db: Tx,
  releaseTarget: schema.ReleaseTarget,
) =>
  db
    .selectDistinctOn([schema.policy.id], {
      policyId: schema.policy.id,
      concurrency: schema.policyRuleConcurrency,
      retry: schema.policyRuleRetry,
    })
    .from(schema.policy)
    .innerJoin(
      schema.policyTarget,
      eq(schema.policyTarget.policyId, schema.policy.id),
    )
    .innerJoin(
      schema.computedPolicyTargetReleaseTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        schema.policyTarget.id,
      ),
    )
    .leftJoin(
      schema.policyRuleRetry,
      eq(schema.policyRuleRetry.policyId, schema.policy.id),
    )
    .leftJoin(
      schema.policyRuleConcurrency,
      eq(schema.policyRuleConcurrency.policyId, schema.policy.id),
    )
    .where(
      eq(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        releaseTarget.id,
      ),
    )
    .orderBy(desc(schema.policy.priority));

const getReleaseTargetsInConcurrencyGroup = async (
  db: Tx,
  policyIds: string[],
  jobReleaseTargetId: string,
) =>
  db
    .select()
    .from(schema.releaseTarget)
    .innerJoin(
      schema.computedPolicyTargetReleaseTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.releaseTargetId,
        schema.releaseTarget.id,
      ),
    )
    .innerJoin(
      schema.policyTarget,
      eq(
        schema.computedPolicyTargetReleaseTarget.policyTargetId,
        schema.policyTarget.id,
      ),
    )
    .where(
      and(
        ne(schema.releaseTarget.id, jobReleaseTargetId),
        inArray(schema.policyTarget.policyId, policyIds),
      ),
    )
    .then((rows) => rows.map((row) => row.release_target));

const getNumRetryAttempts = async (db: Tx, jobId: string) => {
  const releaseResult = await db
    .select()
    .from(schema.release)
    .innerJoin(
      schema.releaseJob,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.variableSetRelease,
      eq(schema.release.variableReleaseId, schema.variableSetRelease.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirst);

  return db
    .select({ count: count() })
    .from(schema.releaseJob)
    .where(eq(schema.releaseJob.releaseId, releaseResult.release.id))
    .then(takeFirst)
    .then((row) => row.count);
};

const retryJob = async (db: Tx, jobId: string) => {
  const releaseResult = await db
    .select()
    .from(schema.release)
    .innerJoin(
      schema.releaseJob,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .innerJoin(
      schema.variableSetRelease,
      eq(schema.release.variableReleaseId, schema.variableSetRelease.id),
    )
    .where(eq(schema.releaseJob.jobId, jobId))
    .then(takeFirst);

  const releaseId = releaseResult.release.id;
  const versionReleaseId = releaseResult.version_release.id;
  const variableReleaseId = releaseResult.variable_set_release.id;

  const newReleaseJob = await db.transaction((tx) =>
    createReleaseJob(tx, {
      id: releaseId,
      versionReleaseId,
      variableReleaseId,
    }),
  );

  await dispatchQueueJob().toDispatch().ctrlplaneJob(newReleaseJob.id);
};

export const updateJob = async (
  db: Tx,
  jobId: string,
  data: schema.UpdateJob,
  metadata?: Record<string, any>,
) => {
  log.info(`updating job: ${jobId}`, { data, metadata });

  const jobBeforeUpdate = await db.query.job.findFirst({
    where: eq(schema.job.id, jobId),
    with: { metadata: true },
  });
  if (jobBeforeUpdate == null) throw new Error(`Job not found: id=${jobId}`);

  const updatedJob = await dbUpdateJob(db, jobId, jobBeforeUpdate, data);
  if (metadata != null)
    await updateJobMetadata(jobId, jobBeforeUpdate.metadata, metadata);

  const isJobJustCompleted = getIsJobJustCompleted(
    jobBeforeUpdate.status as JobStatus,
    updatedJob.status as JobStatus,
  );
  if (!isJobJustCompleted) return updatedJob;

  const releaseTarget = await getReleaseTarget(db, jobId);
  if (releaseTarget == null) return updatedJob;

  const matchedPolicies = await getMatchedPolicies(db, releaseTarget);
  const isJobFailed = failedStatuses.includes(updatedJob.status as JobStatus);
  const firstRetryPolicy = matchedPolicies.find((p) => p.retry != null)?.retry;
  const numRetryAttempts = await getNumRetryAttempts(db, jobId);
  const shouldRetry =
    isJobFailed &&
    firstRetryPolicy != null &&
    numRetryAttempts < firstRetryPolicy.maxRetries;

  if (shouldRetry) {
    await retryJob(db, jobId);
    return updatedJob;
  }

  await dispatchQueueJob().toEvaluate().releaseTargets([releaseTarget]);
  const policiesWithConcurrency = matchedPolicies.filter(
    (p) => p.concurrency != null,
  );
  const releaseTargetsInConcurrencyGroup =
    await getReleaseTargetsInConcurrencyGroup(
      db,
      policiesWithConcurrency.map((p) => p.policyId),
      releaseTarget.id,
    );
  await dispatchQueueJob()
    .toEvaluate()
    .releaseTargets(releaseTargetsInConcurrencyGroup);

  return updatedJob;
};
