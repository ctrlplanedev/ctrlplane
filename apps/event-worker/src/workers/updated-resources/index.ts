import { eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { upsertReleaseTargets } from "../../utils/upsert-release-targets.js";
import { dispatchExitHooks } from "./dispatch-exit-hooks.js";

export const updatedResourceWorker = createWorker(
  Channel.UpdatedResource,
  async ({ data: resource }) => {
    const startTime = performance.now();

    const currentReleaseTargets = await db.query.releaseTarget.findMany({
      where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
    });

    const upsertedReleaseTargets = await upsertReleaseTargets(db, resource);
    const releaseTargetsToDelete = currentReleaseTargets.filter(
      (rt) => !upsertedReleaseTargets.some((nrt) => nrt.id === rt.id),
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
      upsertedReleaseTargets,
    );

    logger.info(
      `dispatching ${upsertedReleaseTargets.length} evaluations for release targets of resource ${resource.id}`,
    );

    const addToEvaluateQueuePromise = getQueue(
      Channel.EvaluateReleaseTarget,
    ).addBulk(
      upsertedReleaseTargets.map((rt) => ({
        name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
        data: rt,
      })),
    );

    await Promise.allSettled([
      dispatchExitHooksPromise,
      addToEvaluateQueuePromise,
    ]);

    const endTime = performance.now();

    logger.info(
      `[time]finished processing updated resource ${resource.id} in ${((endTime - startTime) / 1000).toFixed(2)}s`,
    );
  },
);
