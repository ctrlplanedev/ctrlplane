import { eq, inArray, selector } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { upsertReleaseTargets } from "../../utils/upsert-release-targets.js";
import { dispatchExitHooks } from "./dispatch-exit-hooks.js";
import { withSpan } from "./span.js";

export const updatedResourceWorker = createWorker(
  Channel.UpdatedResource,
  withSpan("updatedResourceWorker", async (span, { data: resource }) => {
    span.setAttribute("resource.id", resource.id);
    span.setAttribute("resource.name", resource.name);
    span.setAttribute("workspace.id", resource.workspaceId);

    const currentReleaseTargets = await db.query.releaseTarget.findMany({
      where: eq(SCHEMA.releaseTarget.resourceId, resource.id),
    });

    const cb = selector().compute();
    await Promise.all([
      cb.allEnvironments(resource.workspaceId).resourceSelectors().replace(),
      cb.allDeployments(resource.workspaceId).resourceSelectors().replace(),
    ]);
    const upsertedReleaseTargets = await upsertReleaseTargets(db, resource);
    await cb
      .allPolicies(resource.workspaceId)
      .releaseTargetSelectors()
      .replace();

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
  }),
);
