import type { HookEvent } from "@ctrlplane/validators/events";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNotNull, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import {
  ComparisonOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";

import { getEventsForDeploymentRemoved, handleEvent } from "./events/index.js";
import { dispatchReleaseJobTriggers } from "./job-dispatch.js";
import { isPassingReleaseStringCheckPolicy } from "./policies/release-string-check.js";
import { isPassingAllPolicies } from "./policy-checker.js";
import { createJobApprovals } from "./policy-create.js";
import { createReleaseJobTriggers } from "./release-job-trigger.js";

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

const getResourcesInNewSystem = async (deployment: SCHEMA.Deployment) => {
  const hasFilter = isNotNull(SCHEMA.environment.resourceFilter);
  const newSystem = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, deployment.systemId),
    with: { environments: { where: hasFilter } },
  });

  if (newSystem == null) return [];

  const filters = newSystem.environments
    .map((env) => env.resourceFilter)
    .filter(isPresent);

  if (filters.length === 0) return [];

  const systemFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: filters,
  };

  return db.query.resource.findMany({
    where: SCHEMA.resourceMatchesMetadata(db, systemFilter),
  });
};

export const handleDeploymentSystemChanged = async (
  deployment: SCHEMA.Deployment,
  prevSystemId: string,
  userId?: string,
) => {
  await getEventsForDeploymentRemoved(deployment, prevSystemId).then((events) =>
    Promise.allSettled(events.map(handleEvent)),
  );

  await moveRunbooksLinkedToHooksToNewSystem(deployment);

  const resources = await getResourcesInNewSystem(deployment);

  const createTriggers =
    userId != null
      ? createReleaseJobTriggers(db, "new_release").causedById(userId)
      : createReleaseJobTriggers(db, "new_release");
  await createTriggers
    .deployments([deployment.id])
    .resources(resources.map((r) => r.id))
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

const handleDeploymentFilterChanged = async (
  deployment: SCHEMA.Deployment,
  prevFilter: ResourceCondition | null,
  userId?: string,
) => {
  const environments = await db.query.environment.findMany({
    where: eq(SCHEMA.environment.systemId, deployment.systemId),
  });

  const isInSystem: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.Or,
    conditions: environments.map((e) => e.resourceFilter).filter(isPresent),
  };

  const oldResourcesFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [prevFilter, isInSystem].filter(isPresent),
  };

  const newResourcesFilter: ResourceCondition = {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [deployment.resourceFilter, isInSystem].filter(isPresent),
  };

  const oldResources = await db.query.resource.findMany({
    where: SCHEMA.resourceMatchesMetadata(db, oldResourcesFilter),
  });

  const newResources = await db.query.resource.findMany({
    where: SCHEMA.resourceMatchesMetadata(db, newResourcesFilter),
  });

  const resourcesToRemove = oldResources.filter(
    (r) => !newResources.some((nr) => nr.id === r.id),
  );
  const resourcesToAdd = newResources.filter(
    (r) => !oldResources.some((nr) => nr.id === r.id),
  );

  const events: HookEvent[] = resourcesToRemove.map((resource) => ({
    action: "deployment.resource.removed",
    payload: { deployment, resource },
  }));

  await Promise.allSettled(events.map(handleEvent));

  const createTriggers =
    userId != null
      ? createReleaseJobTriggers(db, "new_release").causedById(userId)
      : createReleaseJobTriggers(db, "new_release");

  await createTriggers
    .deployments([deployment.id])
    .resources(resourcesToAdd.map((r) => r.id))
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

  if (
    !_.isEqual(prevDeployment.resourceFilter, updatedDeployment.resourceFilter)
  )
    await handleDeploymentFilterChanged(
      updatedDeployment,
      prevDeployment.resourceFilter,
      userId,
    );

  const sys = await db
    .select()
    .from(SCHEMA.system)
    .where(eq(SCHEMA.system.id, updatedDeployment.systemId))
    .then(takeFirst);

  return { ...updatedDeployment, system: sys };
};
