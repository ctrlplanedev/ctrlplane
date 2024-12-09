import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNotNull, isNull, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";

import { handleEvent } from "./events/index.js";
import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingReleaseStringCheckPolicy } from "./policies/release-string-check.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { createJobApprovals } from "./policy-create.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";

const getResourcesOnlyInNewSystem = async (
  newSystemId: string,
  oldSystemId: string,
) => {
  const hasFilter = isNotNull(SCHEMA.environment.resourceFilter);
  const newSystem = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, newSystemId),
    with: { environments: { where: hasFilter } },
  });

  const oldSystem = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, oldSystemId),
    with: { environments: { where: hasFilter } },
  });

  if (newSystem == null || oldSystem == null) return [];

  const newSystemFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: newSystem.environments
      .flatMap((env) => env.resourceFilter)
      .filter(isPresent),
  };

  const notInOldSystemFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.Or,
    not: true,
    conditions: oldSystem.environments
      .flatMap((env) => env.resourceFilter)
      .filter(isPresent),
  };

  const filter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [newSystemFilter, notInOldSystemFilter],
  };

  return db.query.resource.findMany({
    where: and(
      SCHEMA.resourceMatchesMetadata(db, filter),
      isNull(SCHEMA.resource.deletedAt),
    ),
  });
};

export const handleDeploymentSystemChanged = async (
  deployment: SCHEMA.Deployment,
  prevSystemId: string,
  userId?: string,
) => {
  const resourcesOnlyInNewSystem = await getResourcesOnlyInNewSystem(
    deployment.systemId,
    prevSystemId,
  );

  const events = resourcesOnlyInNewSystem.map((resource) => ({
    action: "deployment.resource.removed" as const,
    payload: { deployment, resource },
  }));
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
    .resources(resourcesOnlyInNewSystem.map((r) => r.id))
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
