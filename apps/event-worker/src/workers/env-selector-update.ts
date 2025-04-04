import type { ResourceCondition } from "@ctrlplane/validators/resources";

import { and, eq, isNull } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import * as schema from "@ctrlplane/db/schema";
import { Channel, createWorker } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

const log = logger.child({
  module: "env-selector-update",
  function: "envSelectorUpdateWorker",
});

const getNewlyMatchedResources = async (
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

  return newResources.filter(
    (newResource) =>
      !oldResources.some((oldResource) => oldResource.id === newResource.id),
  );
};

/**
 * Worker that handles environment selector updates.
 *
 * When an environment's resource selector is updated:
 * 1. Finds resources that match the new selector but didn't match the old one
 * 2. For each newly matched resource, creates release targets for all deployments
 *    in the system associated with the environment
 * 3. Inserts the new release targets into the database
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
        with: { system: { with: { deployments: true } } },
      })
      .then((res) => res?.system);

    if (system == null) {
      log.error("System not found", { environmentId: environment.id });
      return;
    }

    const { workspaceId, deployments } = system;

    const newlyMatchedResources = await getNewlyMatchedResources(
      workspaceId,
      oldSelector,
      environment.resourceSelector,
    );

    if (newlyMatchedResources.length === 0) return;

    const releaseTargets = deployments.flatMap((deployment) =>
      newlyMatchedResources.map((resource) => ({
        resourceId: resource.id,
        deploymentId: deployment.id,
        environmentId: environment.id,
      })),
    );

    await db.insert(schema.releaseTarget).values(releaseTargets);
  },
);
