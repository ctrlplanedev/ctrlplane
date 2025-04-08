import type { Tx } from "@ctrlplane/db";
import type { InsertResource, Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, eq, isNull, or } from "@ctrlplane/db";
import { resource } from "@ctrlplane/db/schema";

/**
 * Gets resources for a specific provider
 * @param tx - Database transaction
 * @param providerId - ID of the provider to get resources for
 * @param options - Options object
 * @returns Promise resolving to array of resources
 */
const getResourcesByProvider = (tx: Tx, providerId: string) =>
  tx
    .select()
    .from(resource)
    .where(
      and(eq(resource.providerId, providerId), isNull(resource.deletedAt)),
    );

const getResourcesByWorkspaceIdAndIdentifier = (
  tx: Tx,
  resources: { workspaceId: string; identifier: string }[],
) =>
  tx
    .select()
    .from(resource)
    .where(
      or(
        ...resources.map((r) =>
          and(
            eq(resource.workspaceId, r.workspaceId),
            eq(resource.identifier, r.identifier),
            isNull(resource.deletedAt),
          ),
        ),
      ),
    );

/**
 * Fetches existing resources from the database that match the resources to be
 * inserted. For resources without a providerId, looks them up by workspaceId
 * and identifier. For resources with a providerId, gets all resources for that
 * provider.
 *
 * @param tx - Database transaction
 * @param resourcesToInsert - Array of resources to be inserted
 * @returns Promise resolving to array of existing resources
 */
export const findExistingResources = async (
  tx: Tx,
  resourcesToInsert: InsertResource[],
): Promise<Resource[]> => {
  const resourcesByProvider = _.groupBy(
    resourcesToInsert,
    (r) => r.providerId ?? "null",
  );

  const promises = Object.entries(resourcesByProvider).map(
    ([providerId, resources]) =>
      providerId === "null"
        ? getResourcesByWorkspaceIdAndIdentifier(tx, resources)
        : getResourcesByProvider(tx, providerId),
  );

  const results = await Promise.all(promises);
  return results.flat();
};
