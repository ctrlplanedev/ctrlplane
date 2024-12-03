import { eq, sql, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

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

export const updateJob = async (
  jobId: string,
  data: schema.UpdateJob,
  metadata: Record<string, any>,
) => {
  const jobBeforeUpdate = await db.query.job.findFirst({
    where: eq(schema.job.id, jobId),
    with: { metadata: true },
  });

  if (jobBeforeUpdate == null) throw new Error("Job not found");

  const updatedJob = await db
    .update(schema.job)
    .set(data)
    .where(eq(schema.job.id, jobId))
    .returning()
    .then(takeFirst);

  await updateJobMetadata(jobId, jobBeforeUpdate.metadata, metadata);

  const isJobFailure =
    data.status === JobStatus.Failure &&
    jobBeforeUpdate.status !== JobStatus.Failure;
  if (isJobFailure) await onJobFailure(updatedJob);

  const isJobCompletion =
    data.status === JobStatus.Completed &&
    jobBeforeUpdate.status !== JobStatus.Completed;
  if (isJobCompletion) await onJobCompletion(updatedJob);
};
