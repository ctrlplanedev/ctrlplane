import type { Tx } from "@ctrlplane/db";

import { eq, sql, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

import { onJobCompletion } from "./job-creation.js";
import { onJobFailure } from "./job-failure.js";

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

export const updateJob = async (
  db: Tx,
  jobId: string,
  data: schema.UpdateJob,
  metadata?: Record<string, any>,
) => {
  const jobBeforeUpdate = await db.query.job.findFirst({
    where: eq(schema.job.id, jobId),
    with: { metadata: true },
  });

  if (jobBeforeUpdate == null) throw new Error(`Job not found: id=${jobId}`);

  const startedAt = getStartedAt(jobBeforeUpdate, data);
  const completedAt = getCompletedAt(jobBeforeUpdate, data);
  const updates = { ...data, startedAt, completedAt };

  const updatedJob = await db
    .update(schema.job)
    .set(updates)
    .where(eq(schema.job.id, jobId))
    .returning()
    .then(takeFirst);

  if (metadata != null)
    await updateJobMetadata(jobId, jobBeforeUpdate.metadata, metadata);

  const isJobFailure =
    data.status === JobStatus.Failure &&
    jobBeforeUpdate.status !== JobStatus.Failure;
  if (isJobFailure) await onJobFailure(updatedJob);

  const isJobCompletion =
    data.status === JobStatus.Successful &&
    jobBeforeUpdate.status !== JobStatus.Successful;
  if (isJobCompletion) await onJobCompletion(updatedJob);

  return updatedJob;
};
