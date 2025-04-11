import { db } from "@ctrlplane/db/client";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

const queue = getQueue(Channel.EvaluateReleaseTarget);
export const newResourceWorker = createWorker(
  Channel.NewResource,
  async ({ data: resource }) => {
    console.log("new resource", resource);
    return;
    // db.transaction(async (tx) => {
    //   const rts = await upsertReleaseTargets(tx, resource);
    //   await queue.addBulk(
    //     rts.map((rt) => ({
    //       name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
    //       data: rt,
    //     })),
    //   );
    // }),
  },
);
