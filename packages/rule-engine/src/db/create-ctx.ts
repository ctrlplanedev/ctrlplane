import type { Tx } from "@ctrlplane/db";
import { and, eq } from "drizzle-orm";

import { resourceRelease } from "@ctrlplane/db/schema";

import type { ReleaseRepository } from "../types.js";

/**
 * Creates a deployment resource context by querying the database for a resource
 * release and its related entities.
 *
 * @param tx - Database transaction object for querying
 * @param repo - Repository containing deployment, environment and resource IDs
 * @returns Promise resolving to the resource release with related entities, or
 * null if not found
 */
export const createCtx = async (tx: Tx, repo: ReleaseRepository) => {
  return tx.query.resourceRelease.findFirst({
    where: and(
      eq(resourceRelease.id, repo.resourceId),
      eq(resourceRelease.environmentId, repo.environmentId),
      eq(resourceRelease.deploymentId, repo.deploymentId),
    ),
    with: {
      resource: true,
      environment: true,
      deployment: true,
    },
  });
};
