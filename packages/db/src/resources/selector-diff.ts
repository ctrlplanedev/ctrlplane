import { and, eq, isNull } from "drizzle-orm";

import { ResourceCondition } from "@ctrlplane/validators/resources";

import { Tx } from "../common";
import * as schema from "../schema";

/**
 * Get the difference between two resource selectors.
 *
 * @param db - The database transaction.
 * @param workspaceId - The workspace ID.
 * @param oldSelector - The old selector.
 * @param newSelector - The new selector.
 * @returns The difference between the two selectors
 *  - newlyMatchedResources: The resources that are newly matched by the new selector.
 *  - unmatchedResources: The resources that are no longer matched by the new selector.
 *  - unchangedResources: The resources that are still matched by the new selector.
 */
export const getResourceSelectorDiff = async (
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

  const unchangedResources = oldResources.filter((oldResource) =>
    newResources.some((newResource) => newResource.id === oldResource.id),
  );

  return { newlyMatchedResources, unmatchedResources, unchangedResources };
};
