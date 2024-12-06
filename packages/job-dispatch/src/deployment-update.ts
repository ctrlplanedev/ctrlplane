import { and, eq, inArray, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";

import { getEventsForDeploymentRemoved, handleEvent } from "./events/index.js";
import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingReleaseStringCheckPolicy } from "./policies/release-string-check.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { createJobApprovals } from "./policy-create.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";

export const handleDeploymentSystemChanged = async (
  deployment: SCHEMA.Deployment,
  prevSystemId: string,
  userId?: string,
) => {
  const events = await getEventsForDeploymentRemoved(deployment, prevSystemId);
  await Promise.allSettled(events.map(handleEvent));

  const isDeploymentHook = and(
    eq(SCHEMA.hook.scopeType, "deployment"),
    eq(SCHEMA.hook.scopeId, deployment.id),
  );
  await db.query.hook
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

  const createTriggers =
    userId != null
      ? createReleaseJobTriggers(db, "new_release").causedById(userId)
      : createReleaseJobTriggers(db, "new_release");
  await createTriggers
    .deployments([deployment.id])
    .filter(isPassingReleaseStringCheckPolicy)
    .then(createJobApprovals)
    .insert()
    .then((triggers) =>
      dispatchReleaseJobTriggers(db)
        .releaseTriggers(triggers)
        .filter(isPassingAllPolicies)
        .dispatch(),
    );
};

export const updateDeployment = async (
  deploymentId: string,
  data: SCHEMA.UpdateDeployment,
  userId?: string,
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
      userId,
    );

  const sys = await db
    .select()
    .from(SCHEMA.system)
    .where(eq(SCHEMA.system.id, updatedDeployment.systemId))
    .then(takeFirst);

  return { ...updatedDeployment, system: sys };
};
