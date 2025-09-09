import { eq } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";

export const updateJob = async (
  jobId: string,
  data: schema.UpdateJob,
  metadata?: Record<string, any>,
) => {
  const prevJobDbResult = await db.query.job.findFirst({
    where: eq(schema.job.id, jobId),
    with: { metadata: true },
  });
  if (prevJobDbResult == null) throw new Error("Job not found");
  const currentMetadata = Object.fromEntries(
    prevJobDbResult.metadata.map((m) => [m.key, m.value]),
  );
  const prevJob = { ...prevJobDbResult, metadata: currentMetadata };

  const updates = { ...prevJob, ...data, metadata };
  await eventDispatcher.dispatchJobUpdated(prevJob, updates);
};
