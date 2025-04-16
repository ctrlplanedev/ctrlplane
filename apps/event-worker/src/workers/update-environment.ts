import type { Tx } from "@ctrlplane/db";
import _ from "lodash";

import { eq, selector, takeFirst } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker, getQueue } from "@ctrlplane/events";
import { handleEvent } from "@ctrlplane/job-dispatch";
import { logger } from "@ctrlplane/logger";

import { upsertReleaseTargets } from "../utils/upsert-release-targets.js";

const log = logger.child({
  module: "env-selector-update",
  function: "envSelectorUpdateWorker",
});

const dispatchExitHooks = async (
  db: Tx,
  systemId: string,
  exitedResources: schema.Resource[],
) => {
  const deployments = await db
    .select()
    .from(schema.deployment)
    .where(eq(schema.deployment.systemId, systemId));

  const events = exitedResources.flatMap((resource) =>
    deployments.map((deployment) => ({
      action: "deployment.resource.removed" as const,
      payload: { deployment, resource },
    })),
  );

  const handleEventPromises = events.map(handleEvent);
  await Promise.allSettled(handleEventPromises);
};

const recomputeResourcesAndReturnDiff = async (
  db: Tx,
  environmentId: string,
) => {
  const currentComputedResources = await db
    .select()
    .from(schema.computedEnvironmentResource)
    .innerJoin(
      schema.resource,
      eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
    )
    .where(eq(schema.computedEnvironmentResource.environmentId, environmentId));
  const currentResources = currentComputedResources.map((r) => r.resource);

  await selector()
    .compute()
    .environments([environmentId])
    .resourceSelectors()
    .replace();

  const newComputedResources = await db
    .select()
    .from(schema.computedEnvironmentResource)
    .innerJoin(
      schema.resource,
      eq(schema.computedEnvironmentResource.resourceId, schema.resource.id),
    )
    .where(eq(schema.computedEnvironmentResource.environmentId, environmentId));

  const newResources = newComputedResources.map((r) => r.resource);

  const exitedResources = currentResources.filter(
    (r) => !newResources.some((nr) => nr.id === r.id),
  );

  return { newResources, exitedResources };
};

/**
 * Worker that handles environment updates.
 *
 * When an environment is updated:
 * 1. Finds newly matched resources and resources that no longer match the selector
 * 2. For each newly matched resource,
 *    - creates release targets for all deployments in the system associated with the environment
 *    - inserts the new release targets into the database
 * 3. For each unmatched resource,
 *    - removes the release targets (and consequently the releases) for the resource + environment
 *    - dispatches exit hooks for the resource per deployment if the resource is no longer in the system
 *
 * @param {Job<ChannelMap[Channel.UpdateEnvironment]>} job - The job containing environment data with old and new selectors
 * @returns {Promise<void>} - Resolves when processing is complete
 * @throws {Error} - If there's an issue with database operations
 */
export const updateEnvironmentWorker = createWorker(
  Channel.UpdateEnvironment,
  async (job) => {
    try {
      const { oldSelector, ...environment } = job.data;
      if (_.isEqual(oldSelector, environment.resourceSelector)) return;

      const { newResources, exitedResources } =
        await recomputeResourcesAndReturnDiff(db, environment.id);

      const system = await db
        .select()
        .from(schema.system)
        .where(eq(schema.system.id, environment.systemId))
        .then(takeFirst);
      const { workspaceId } = system;

      await selector()
        .compute()
        .allPolicies(workspaceId)
        .releaseTargetSelectors()
        .replace();

      const releaseTargetPromises = newResources.map(async (r) =>
        upsertReleaseTargets(db, r),
      );
      const fulfilled = await Promise.all(releaseTargetPromises);
      const rts = fulfilled.flat();

      const evaluateJobs = rts.map((rt) => ({ name: rt.id, data: rt }));
      await getQueue(Channel.EvaluateReleaseTarget).addBulk(evaluateJobs);

      await dispatchExitHooks(db, environment.systemId, exitedResources);
    } catch (error) {
      log.error("Error updating environment", { error });
      throw error;
    }
  },
);
