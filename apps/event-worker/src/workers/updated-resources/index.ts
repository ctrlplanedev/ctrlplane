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
    logger.info(`started processing updated resource ${resource.id}`);

    const currentReleaseTargets = await db.query.releaseTarget.findMany({
      where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
    });

    await upsertReleaseTargets(db, resource);

    logger.info(`finished processing updated resource ${resource.id}`);

    return;

    // db.transaction(async (tx) => {
    //   const currentReleaseTargets = await tx.query.releaseTarget.findMany({
    //     where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
    //   });

    //   const newReleaseTargets = await upsertReleaseTargets(tx, resource);
    //   const releaseTargetsToDelete = currentReleaseTargets.filter(
    //     (rt) => !newReleaseTargets.some((nrt) => nrt.id === rt.id),
    //   );

    //   await tx.delete(SCHEMA.releaseTarget).where(
    //     inArray(
    //       SCHEMA.releaseTarget.id,
    //       releaseTargetsToDelete.map((rt) => rt.id),
    //     ),
    //   );

    //   const dispatchExitHooksPromise = dispatchExitHooks(
    //     tx,
    //     resource,
    //     currentReleaseTargets,
    //     newReleaseTargets,
    //   );

    //   const addToEvaluateQueuePromise = getQueue(
    //     Channel.EvaluateReleaseTarget,
    //   ).addBulk(
    //     newReleaseTargets.map((rt) => ({
    //       name: `${rt.resourceId}-${rt.environmentId}-${rt.deploymentId}`,
    //       data: rt,
    //     })),
    //   );

    //   await Promise.allSettled([
    //     dispatchExitHooksPromise,
    //     addToEvaluateQueuePromise,
    //   ]);
    // });
  },
);
