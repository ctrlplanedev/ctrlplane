import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, desc, eq, inArray, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

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
      releaseChannels: { with: { releaseChannel: true } },
      policy: {
        with: {
          environmentPolicyReleaseChannels: { with: { releaseChannel: true } },
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
  log.info("Dispatching jobs for added resources", { resourceIds, envId });

  const environment = await getEnvironmentWithReleaseChannels(db, envId);
  if (environment == null) {
    log.warn("Environment not found", { envId });
    return;
  }

  const { releaseChannels, policy, system } = environment;
  const { deployments } = system;
  const policyReleaseChannels = policy?.environmentPolicyReleaseChannels ?? [];
  const deploymentsWithReleaseFilter = deployments.map((deployment) => {
    const envReleaseChannel = releaseChannels.find(
      (erc) => erc.deploymentId === deployment.id,
    );
    const policyReleaseChannel = policyReleaseChannels.find(
      (prc) => prc.deploymentId === deployment.id,
    );

    const { releaseFilter } =
      envReleaseChannel?.releaseChannel ??
      policyReleaseChannel?.releaseChannel ??
      {};
    return { ...deployment, releaseFilter };
  });

  log.debug("Fetching latest releases", {
    deploymentCount: deployments.length,
  });
  const releasePromises = deploymentsWithReleaseFilter.map(
    ({ id, releaseFilter }) =>
      db
        .select()
        .from(SCHEMA.release)
        .where(
          and(
            eq(SCHEMA.release.deploymentId, id),
            SCHEMA.releaseMatchesCondition(db, releaseFilter ?? undefined),
          ),
        )
        .orderBy(desc(SCHEMA.release.createdAt))
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
 * Dispatches hook events for resources that were removed from an environment
 * @param db - Database transaction
 * @param resourceIds - IDs of the resources that were removed
 * @param envId - ID of the environment the resources were removed from
 */
export const dispatchEventsForRemovedResources = async (
  db: Tx,
  resourceIds: string[],
  envId: string,
): Promise<void> => {
  log.info("Dispatching events for removed resources", { resourceIds, envId });

  const deployments = await getEnvironmentDeployments(db, envId);
  if (deployments.length === 0) {
    log.info("No deployments found for environment");
    return;
  }

  const resources = await db.query.resource.findMany({
    where: inArray(SCHEMA.resource.id, resourceIds),
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
  if (failures > 0) {
    log.warn("Some removal events failed", { failureCount: failures });
  }

  log.info("Finished dispatching removal events", {
    total: events.length,
    succeeded: events.length - failures,
    failed: failures,
  });
};
