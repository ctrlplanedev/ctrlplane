import type { Tx } from "@ctrlplane/db";

import { and, eq } from "@ctrlplane/db";
import { releaseTarget } from "@ctrlplane/db/schema";

import type { ReleaseTargetIdentifier } from "../types.js";

/**
 * Creates a deployment resource context by querying the database for a resource
 * release and its related entities.
 *
 * @param tx - Database transaction object for querying
 * @param releaseTargetIdentifier - Repository containing deployment, environment and resource IDs
 * @returns Promise resolving to the resource release with related entities, or
 * null if not found
 */
export const createCtx = async (
  tx: Tx,
  releaseTargetIdentifier: ReleaseTargetIdentifier,
) => {
  return tx.query.releaseTarget.findFirst({
    where: and(
      eq(releaseTarget.id, releaseTargetIdentifier.resourceId),
      eq(releaseTarget.environmentId, releaseTargetIdentifier.environmentId),
      eq(releaseTarget.deploymentId, releaseTargetIdentifier.deploymentId),
    ),
    with: {
      resource: true,
      environment: true,
      deployment: true,
    },
  });
};
