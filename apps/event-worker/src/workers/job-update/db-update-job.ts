import type { Tx } from "@ctrlplane/db";

import { eq, takeFirst } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { exitedStatus, JobStatus } from "@ctrlplane/validators/jobs";

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

export const dbUpdateJob = async (
  db: Tx,
  jobId: string,
  jobBeforeUpdate: schema.Job,
  data: schema.UpdateJob,
) => {
  const { updatedAt: _updatedAt } = data;
  const startedAtResult = getStartedAt(jobBeforeUpdate, data);
  const completedAtResult = getCompletedAt(jobBeforeUpdate, data);
  const startedAt = startedAtResult != null ? new Date(startedAtResult) : null;
  const completedAt =
    completedAtResult != null ? new Date(completedAtResult) : null;
  const updatedAt = _updatedAt != null ? new Date(_updatedAt) : undefined;
  const updates = { ...data, startedAt, completedAt, updatedAt };

  return db
    .update(schema.job)
    .set(updates)
    .where(eq(schema.job.id, jobId))
    .returning()
    .then(takeFirst);
};
