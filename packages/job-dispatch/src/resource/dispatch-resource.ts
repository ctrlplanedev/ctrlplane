import type { Tx } from "@ctrlplane/db";
import { isPresent } from "ts-is-present";

import { and, desc, eq, takeFirstOrNull } from "@ctrlplane/db";
import * as SCHEMA from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

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
const getEnvironmentWithVersionChannels = (db: Tx, envId: string) =>
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

  const environment = await getEnvironmentWithVersionChannels(db, envId);
  if (environment == null) {
    log.warn("Environment not found", { envId });
    return;
  }

  const { policy, system } = environment;
  const { deployments } = system;
  const { environmentPolicyDeploymentVersionChannels } = policy;
  const deploymentsWithVersionSelector = deployments.map((deployment) => {
    const policy = environmentPolicyDeploymentVersionChannels.find(
      (prc) => prc.deploymentId === deployment.id,
    );

    const { versionSelector } = policy?.deploymentVersionChannel ?? {};
    return { ...deployment, versionSelector };
  });

  log.debug("Fetching latest versions", {
    deploymentCount: deployments.length,
  });
  const versionPromises = deploymentsWithVersionSelector.map(
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

  const versions = await Promise.all(versionPromises).then((rows) =>
    rows.filter(isPresent),
  );
  if (versions.length === 0) {
    log.info("No versions found for deployments");
    return;
  }

  log.debug("Creating release job triggers");
  const releaseJobTriggers = await createReleaseJobTriggers(db, "new_resource")
    .resources(resourceIds)
    .environments([envId])
    .versions(versions.map((v) => v.id))
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
