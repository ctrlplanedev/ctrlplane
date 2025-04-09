import { eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";

import { dispatchExitHooks } from "./dispatch-exit-hooks.js";
import { upsertReleaseTargets } from "./upsert-release-targets.js";

export const upsertedResourceWorker = createWorker(
  Channel.UpsertedResource,
  async ({ data: resource }) => {
    const currentReleaseTargets = await db.query.releaseTarget.findMany({
      where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
    });

    const newReleaseTargets = await upsertReleaseTargets(db, resource);
    const releaseTargetsToDelete = currentReleaseTargets.filter(
      (rt) => !newReleaseTargets.some((nrt) => nrt.id === rt.id),
    );

    await db.delete(SCHEMA.releaseTarget).where(
      inArray(
        SCHEMA.releaseTarget.id,
        releaseTargetsToDelete.map((rt) => rt.id),
      ),
    );

    const dispatchExitHooksPromise = dispatchExitHooks(
      db,
      resource,
      currentReleaseTargets,
      newReleaseTargets,
    );

    const addToEvaluateQueuePromise = getQueue(
      Channel.EvaluateReleaseTarget,
    ).addBulk(
      newReleaseTargets.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      })),
    );

    await Promise.allSettled([
      dispatchExitHooksPromise,
      addToEvaluateQueuePromise,
    ]);
  },
);
