import type * as schema from "@ctrlplane/db/schema";
import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";
import { WorkspaceManager } from "../workspace/workspace.js";

const getJobWithDates = (job: schema.Job) => {
  const createdAt = new Date(job.createdAt);
  const updatedAt = new Date(job.updatedAt);
  const startedAt = job.startedAt != null ? new Date(job.startedAt) : null;
  const completedAt =
    job.completedAt != null ? new Date(job.completedAt) : null;
  return { ...job, createdAt, updatedAt, startedAt, completedAt };
};

export const updateJob: Handler<Event.JobUpdated> = async (event) => {
  const { current } = event.payload;
  const ws = await WorkspaceManager.getOrLoad(event.workspaceId);
  if (ws == null) return;
  const job = getJobWithDates(current);
  await OperationPipeline.update(ws).job(job).dispatch();
};
