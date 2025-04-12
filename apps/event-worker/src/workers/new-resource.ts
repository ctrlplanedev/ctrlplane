import { db } from "@ctrlplane/db/client";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

const queue = getQueue(Channel.EvaluateReleaseTarget);
export const newResourceWorker = createWorker(
  Channel.NewResource,
  async ({ data: resource }) => {
    const rts = await upsertReleaseTargets(db, resource);
    const jobs = rts.map((rt) => ({
      name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
      data: rt,
    }));
    await queue.addBulk(jobs);
  },
);
