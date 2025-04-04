import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import { and, eq, inArray, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";
import {
  ComparisonOperator,
  ConditionType,
} from "@ctrlplane/validators/conditions";

const log = logger.child({
  module: "env-selector-update",
  function: "envSelectorUpdateWorker",
});

const getAffectedResources = async (
  db: Tx,
  workspaceId: string,
  oldSelector: ResourceCondition | null,
  newSelector: ResourceCondition | null,
) => {
  const oldResources =
    oldSelector == null
      ? []
      : await db.query.resource.findMany({
          where: and(
            eq(schema.resource.workspaceId, workspaceId),
            schema.resourceMatchesMetadata(db, oldSelector),
            isNull(schema.resource.deletedAt),
          ),
        });

  const newResources =
    newSelector == null
      ? []
      : await db.query.resource.findMany({
          where: and(
            eq(schema.resource.workspaceId, workspaceId),
            schema.resourceMatchesMetadata(db, newSelector),
            isNull(schema.resource.deletedAt),
          ),
        });

  const newlyMatchedResources = newResources.filter(
    (newResource) =>
      !oldResources.some((oldResource) => oldResource.id === newResource.id),
  );

  const unmatchedResources = oldResources.filter(
    (oldResource) =>
      !newResources.some((newResource) => newResource.id === oldResource.id),
  );

  return { newlyMatchedResources, unmatchedResources };
};

const createReleaseTargets = (
  db: Tx,
  newlyMatchedResources: schema.Resource[],
  environmentId: string,
  deployments: schema.Deployment[],
) =>
  db.insert(schema.releaseTarget).values(
    newlyMatchedResources.flatMap((resource) =>
      deployments.map((deployment) => ({
        resourceId: resource.id,
        deploymentId: deployment.id,
        environmentId: environmentId,
      })),
    ),
  );

const removeReleaseTargets = (
  db: Tx,
  unmatchedResources: schema.Resource[],
  environmentId: string,
) =>
  db.delete(schema.releaseTarget).where(
    and(
      eq(schema.releaseTarget.environmentId, environmentId),
      inArray(
        schema.releaseTarget.resourceId,
        unmatchedResources.map((r) => r.id),
      ),
    ),
  );

type SystemWithDeploymentsAndEnvironments = schema.System & {
  deployments: schema.Deployment[];
  environments: schema.Environment[];
};

const getNotInSystemCondition = (
  environmentId: string,
  system: SystemWithDeploymentsAndEnvironments,
): ResourceCondition | null => {
  const otherEnvironmentsWithSelector = system.environments.filter(
    (e) => e.id !== environmentId && e.resourceSelector != null,
  );

  if (otherEnvironmentsWithSelector.length === 0) return null;

  return {
    type: ConditionType.Comparison,
    operator: ComparisonOperator.Or,
    not: true,
    conditions: otherEnvironmentsWithSelector
      .map((e) => e.resourceSelector)
      .filter(isPresent),
  };
};

const dispatchExitHooks = async (
  db: Tx,
  environmentId: string,
  system: SystemWithDeploymentsAndEnvironments,
  unmatchedResources: schema.Resource[],
) => {
  const notInSystemCondition = getNotInSystemCondition(environmentId, system);

  if (notInSystemCondition == null) return;

  const exitedResources = await db.query.resource.findMany({
    where: and(
      eq(schema.resource.workspaceId, system.workspaceId),
      isNull(schema.resource.deletedAt),
      schema.resourceMatchesMetadata(db, notInSystemCondition),
      inArray(
        schema.resource.id,
        unmatchedResources.map((r) => r.id),
      ),
    ),
  });

  const events = exitedResources.flatMap((resource) =>
    system.deployments.map((deployment) => ({
      action: "deployment.resource.removed" as const,
      payload: { deployment, resource },
    })),
  );

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

/**
 * Worker that handles environment selector updates.
 *
 * When an environment's resource selector is updated:
 * 1. Finds newly matched resources and resources that no longer match the selector
 * 2. For each newly matched resource,
 *    - creates release targets for all deployments in the system associated with the environment
 *    - inserts the new release targets into the database
 * 3. For each unmatched resource,
 *    - removes the release targets (and consequently the releases) for the resource + environment
 *    - dispatches exit hooks for the resource per deployment if the resource is no longer in the system
 *
 * @param {Job<ChannelMap[Channel.EnvironmentSelectorUpdate]>} job - The job containing environment data with old and new selectors
 * @returns {Promise<void>} - Resolves when processing is complete
 * @throws {Error} - If there's an issue with database operations
 */
export const envSelectorUpdateWorker = createWorker(
  Channel.EnvironmentSelectorUpdate,
  async (job) => {
    const { oldSelector, ...environment } = job.data;
    const system = await db.query.environment
      .findFirst({
        where: eq(schema.environment.id, environment.id),
        with: { system: { with: { deployments: true, environments: true } } },
      })
      .then((res) => res?.system);

    if (system == null) {
      log.error("System not found", { environmentId: environment.id });
      return;
    }

    const { workspaceId, deployments } = system;

    const { newlyMatchedResources, unmatchedResources } =
      await getAffectedResources(
        db,
        workspaceId,
        oldSelector,
        environment.resourceSelector,
      );

    const createReleaseTargetsPromise = createReleaseTargets(
      db,
      newlyMatchedResources,
      environment.id,
      deployments,
    );

    const removeReleaseTargetsPromise = removeReleaseTargets(
      db,
      unmatchedResources,
      environment.id,
    );

    const dispatchExitHooksPromise = dispatchExitHooks(
      db,
      environment.id,
      system,
      unmatchedResources,
    );

    await Promise.all([
      createReleaseTargetsPromise,
      removeReleaseTargetsPromise,
      dispatchExitHooksPromise,
    ]);
  },
);
