import type { Tx } from "@ctrlplane/db";

import { desc, eq, sql, takeFirst, takeFirstOrNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { createReleaseJob } from "@ctrlplane/db/queries";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

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

const getIsJobJustCompleted = (
  previousStatus: JobStatus,
  newStatus: JobStatus,
) => {
  const isPreviousStatusExited = exitedStatus.includes(previousStatus);
  const isNewStatusExited = exitedStatus.includes(newStatus);
  return !isPreviousStatusExited && isNewStatusExited;
};

const getReleaseTargetFromJob = (jobId: string) =>
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
    .where(eq(schema.job.id, jobId))
    .then(takeFirstOrNull)
    .then((result) => result?.release_target ?? null);

const getLatestReleaseForReleaseTarget = (releaseTargetId: string) =>
  db
    .select()
    .from(schema.release)
    .innerJoin(
      schema.versionRelease,
      eq(schema.release.versionReleaseId, schema.versionRelease.id),
    )
    .leftJoin(
      schema.releaseJob,
      eq(schema.releaseJob.releaseId, schema.release.id),
    )
    .orderBy(desc(schema.release.createdAt))
    .limit(1)
    .where(eq(schema.versionRelease.releaseTargetId, releaseTargetId))
    .then(takeFirstOrNull);

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

  const isJobJustCompleted = getIsJobJustCompleted(
    jobBeforeUpdate.status as JobStatus,
    updatedJob.status as JobStatus,
  );
  if (!isJobJustCompleted) return updatedJob;

  const releaseTarget = await getReleaseTargetFromJob(jobId);
  if (releaseTarget == null) {
    log.warn(`Release target not found for job: ${jobId}`);
    return updatedJob;
  }

  const latestRelease = await getLatestReleaseForReleaseTarget(
    releaseTarget.id,
  );
  if (latestRelease == null || latestRelease.release_job != null)
    return updatedJob;
  await createReleaseJob(db, latestRelease.release);

  return updatedJob;
};
