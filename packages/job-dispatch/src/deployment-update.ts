import { and, eq, inArray, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { eventDispatcher } from "@ctrlplane/events";

import { getEventsForDeploymentRemoved, handleEvent } from "./events/index.js";

const moveRunbooksLinkedToHooksToNewSystem = async (
  deployment: SCHEMA.Deployment,
) => {
  const isDeploymentHook = and(
    eq(SCHEMA.hook.scopeType, "deployment"),
    eq(SCHEMA.hook.scopeId, deployment.id),
  );

  return db.query.hook
    .findMany({
      where: isDeploymentHook,
      with: { runhooks: { with: { runbook: true } } },
    })
    .then((hooks) => {
      const runbookIds = hooks.flatMap((h) =>
        h.runhooks.map((rh) => rh.runbook.id),
      );
      return db
        .update(SCHEMA.runbook)
        .set({ systemId: deployment.systemId })
        .where(inArray(SCHEMA.runbook.id, runbookIds));
    });
};

export const handleDeploymentSystemChanged = async (
  deployment: SCHEMA.Deployment,
  prevSystemId: string,
) => {
  await getEventsForDeploymentRemoved(deployment, prevSystemId).then((events) =>
    Promise.allSettled(events.map(handleEvent)),
  );

  await moveRunbooksLinkedToHooksToNewSystem(deployment);
};

export const updateDeployment = async (
  deploymentId: string,
  data: SCHEMA.UpdateDeployment,
) => {
  const prevDeployment = await db
    .select()
    .from(SCHEMA.deployment)
    .where(eq(SCHEMA.deployment.id, deploymentId))
    .then(takeFirst);

  const updatedDeployment = await db
    .update(SCHEMA.deployment)
    .set(data)
    .where(eq(SCHEMA.deployment.id, deploymentId))
    .returning()
    .then(takeFirst);

  if (prevDeployment.systemId !== updatedDeployment.systemId)
    await handleDeploymentSystemChanged(
      updatedDeployment,
      prevDeployment.systemId,
    );

  await eventDispatcher.dispatchDeploymentUpdated(
    prevDeployment,
    updatedDeployment,
  );

  const sys = await db
    .select()
    .from(SCHEMA.system)
    .where(eq(SCHEMA.system.id, updatedDeployment.systemId))
    .then(takeFirst);

  return { ...updatedDeployment, system: sys };
};
