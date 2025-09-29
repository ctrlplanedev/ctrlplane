import type * as schema from "@ctrlplane/db/schema";
import type { Event } from "@ctrlplane/events";

import type { Handler } from ".";
import { OperationPipeline } from "../workspace/pipeline.js";

const getJobWithDates = (job: schema.Job) => {
  const createdAt = new Date(job.createdAt);
  const updatedAt = new Date(job.updatedAt);
  const startedAt = job.startedAt != null ? new Date(job.startedAt) : null;
  const completedAt =
    job.completedAt != null ? new Date(job.completedAt) : null;
  return { ...job, createdAt, updatedAt, startedAt, completedAt };
};

export const updateJob: Handler<Event.JobUpdated> = async (event, ws, span) => {
  span.setAttribute("job.id", event.payload.current.id);

  const job = getJobWithDates(event.payload.current);
  await OperationPipeline.update(ws).job(job).dispatch();
};
