import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "../index.js";

export const dispatchUpdatedResourceJob = async (resource: schema.Resource) => {
  const q = getQueue(Channel.UpdatedResource);
  const waiting = await q.getWaiting();
  const isAlreadyQueued = waiting.some((job) => job.data.id === resource.id);
  if (isAlreadyQueued) return;
  await q.add(resource.id, resource);
};
