import type * as schema from "@ctrlplane/db/schema";

import { Channel, getQueue } from "../index.js";

export const dispatchUpdatedResourceJob = async (
  resources: schema.Resource[],
) => {
  const q = getQueue(Channel.UpdatedResource);
  const waiting = await q.getWaiting();
  const waitingIds = new Set(waiting.map((job) => job.data.id));
  const resourcesNotAlreadyQueued = resources.filter(
    (resource) => !waitingIds.has(resource.id),
  );

  const insertJobs = resourcesNotAlreadyQueued.map((r) => ({
    name: r.id,
    data: r,
  }));
  await q.addBulk(insertJobs);
};
