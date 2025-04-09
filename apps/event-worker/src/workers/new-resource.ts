import { db } from "@ctrlplane/db/client";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

const queue = getQueue(Channel.EvaluateReleaseTarget);
export const newResourceWorker = createWorker(
  Channel.NewResource,
  ({ data: resource }) =>
    upsertReleaseTargets(db, resource).then(async (rts) => {
      await queue.addBulk(
        rts.map((rt) => ({
          name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
          data: rt,
        })),
      );
    }),
);
