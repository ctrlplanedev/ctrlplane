import type { Tx } from "@ctrlplane/db";
import type { ResourceCondition } from "@ctrlplane/validators/resources";
import { isPresent } from "ts-is-present";

import {
  and,
  desc,
  eq,
  inArray,
  isNotNull,
  takeFirstOrNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { ComparisonOperator } from "@ctrlplane/validators/conditions";
import { ResourceFilterType } from "@ctrlplane/validators/resources";

import { handleEvent } from "../events/index.js";
import { dispatchReleaseJobTriggers } from "../job-dispatch.js";
import { isPassingAllPolicies } from "../policy-checker.js";
import { createJobApprovals } from "../policy-create.js";
import { createReleaseJobTriggers } from "../release-job-trigger.js";

const log = logger.child({ label: "dispatch-resource" });

/**
 * Gets an environment with its associated release channels, policy, and system information
 * @param db - Database transaction
 * @param envId - Environment ID to look up
 * @returns Promise resolving to the environment with its relationships or null if not found
 */
const getEnvironmentWithReleaseChannels = (db: Tx, envId: string) =>
  db.query.environment.findFirst({
    where: eq(SCHEMA.environment.id, envId),
    with: {
      policy: {
        with: {
          environmentPolicyDeploymentVersionChannels: {
            with: { deploymentVersionChannel: true },
          },
        },
      },
      system: { with: { deployments: true } },
    },
  });

/**
 * Dispatches jobs for newly added resources in an environment
 * @param db - Database transaction
 * @param resourceIds - IDs of the resources that were added
 * @param envId - ID of the environment the resources were added to
 */
export async function dispatchJobsForAddedResources(
  db: Tx,
  resourceIds: string[],
  envId: string,
): Promise<void> {
  if (resourceIds.length === 0) return;
  log.info("Dispatching jobs for added resources", { resourceIds, envId });

  const environment = await getEnvironmentWithReleaseChannels(db, envId);
  if (environment == null) {
    log.warn("Environment not found", { envId });
    return;
  }

  const { policy, system } = environment;
  const { deployments } = system;
  const { environmentPolicyDeploymentVersionChannels } = policy;
  const deploymentsWithReleaseFilter = deployments.map((deployment) => {
    const policy = environmentPolicyDeploymentVersionChannels.find(
      (prc) => prc.deploymentId === deployment.id,
    );

    const { versionSelector } = policy?.deploymentVersionChannel ?? {};
    return { ...deployment, versionSelector };
  });

  log.debug("Fetching latest releases", {
    deploymentCount: deployments.length,
  });
  const releasePromises = deploymentsWithReleaseFilter.map(
    ({ id, versionSelector }) =>
      db
        .select()
        .from(SCHEMA.deploymentVersion)
        .where(
          and(
            eq(SCHEMA.deploymentVersion.deploymentId, id),
            SCHEMA.deploymentVersionMatchesCondition(
              db,
              versionSelector ?? undefined,
            ),
          ),
        )
        .orderBy(desc(SCHEMA.deploymentVersion.createdAt))
        .limit(1)
        .then(takeFirstOrNull),
  );

  const releases = await Promise.all(releasePromises).then((rows) =>
    rows.filter(isPresent),
  );
  if (releases.length === 0) {
    log.info("No releases found for deployments");
    return;
  }

  log.debug("Creating release job triggers");
  const releaseJobTriggers = await createReleaseJobTriggers(db, "new_resource")
    .resources(resourceIds)
    .environments([envId])
    .releases(releases.map((r) => r.id))
    .then(createJobApprovals)
    .insert();

  if (releaseJobTriggers.length === 0) {
    log.info("No job triggers created");
    return;
  }

  log.debug("Dispatching release job triggers", {
    count: releaseJobTriggers.length,
  });
  await dispatchReleaseJobTriggers(db)
    .filter(isPassingAllPolicies)
    .releaseTriggers(releaseJobTriggers)
    .dispatch();

  log.info("Successfully dispatched jobs for added resources", {
    resourceCount: resourceIds.length,
    triggerCount: releaseJobTriggers.length,
  });
}

/**
 * Gets all deployments associated with an environment
 * @param db - Database transaction
 * @param envId - Environment ID to get deployments for
 * @returns Promise resolving to array of deployments
 */
const getEnvironmentDeployments = (db: Tx, envId: string) =>
  db
    .select()
    .from(SCHEMA.deployment)
    .innerJoin(SCHEMA.system, eq(SCHEMA.deployment.systemId, SCHEMA.system.id))
    .innerJoin(
      SCHEMA.environment,
      eq(SCHEMA.system.id, SCHEMA.environment.systemId),
    )
    .where(eq(SCHEMA.environment.id, envId))
    .then((rows) => rows.map((r) => r.deployment));

/**
 * Gets the not in system filter for a system
 * @param systemId - System ID to get the not in system filter for
 * @returns Promise resolving to the not in system filter or null if not found
 */
const getNotInSystemFilter = async (
  systemId: string,
): Promise<ResourceCondition | null> => {
  const hasFilter = isNotNull(SCHEMA.environment.resourceFilter);
  const system = await db.query.system.findFirst({
    where: eq(SCHEMA.system.id, systemId),
    with: { environments: { where: hasFilter } },
  });
  if (system == null) return null;

  const filters = system.environments
    .map((e) => e.resourceFilter)
    .filter(isPresent);
  if (filters.length === 0) return null;

  return {
    type: ResourceFilterType.Comparison,
    operator: ComparisonOperator.Or,
    not: true,
    conditions: filters,
  };
};

/**
 * Dispatches hook events for resources that were removed from an environment
 * @param db - Database transaction
 * @param resourceIds - IDs of the resources that were removed
 * @param env - Environment the resources were removed from
 */
export const dispatchEventsForRemovedResources = async (
  db: Tx,
  resourceIds: string[],
  env: { id: string; systemId: string },
): Promise<void> => {
  const { id: envId, systemId } = env;
  log.info("Dispatching events for removed resources", { resourceIds, envId });

  const deployments = await getEnvironmentDeployments(db, envId);
  if (deployments.length === 0) {
    log.info("No deployments found for environment");
    return;
  }

  const notInSystemFilter = await getNotInSystemFilter(systemId);
  if (notInSystemFilter == null) {
    log.warn("No system found for environment", { envId });
    return;
  }

  const matchesResources = inArray(SCHEMA.resource.id, resourceIds);
  const isRemovedFromSystem = SCHEMA.resourceMatchesMetadata(
    db,
    notInSystemFilter,
  );
  const resources = await db.query.resource.findMany({
    where: and(matchesResources, isRemovedFromSystem),
  });

  log.debug("Creating removal events", {
    resourceCount: resources.length,
    deploymentCount: deployments.length,
  });
  const events = resources.flatMap((resource) =>
    deployments.map((deployment) => ({
      action: "deployment.resource.removed" as const,
      payload: { deployment, resource },
    })),
  );

  log.debug("Handling removal events", { eventCount: events.length });
  const handleEventPromises = events.map(handleEvent);
  const results = await Promise.allSettled(handleEventPromises);

  const failures = results.filter((r) => r.status === "rejected").length;
  if (failures > 0)
    log.warn("Some removal events failed", { failureCount: failures });

  log.info("Finished dispatching removal events", {
    total: events.length,
    succeeded: events.length - failures,
    failed: failures,
  });
};
