import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";

export const updateJob = async (
  jobId: string,
  data: schema.UpdateJob,
  metadata?: Record<string, any>,
) => getQueue(Channel.UpdateJob).add(jobId, { jobId, data, metadata });
