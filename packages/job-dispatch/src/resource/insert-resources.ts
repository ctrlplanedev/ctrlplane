import type { Tx } from "@ctrlplane/db";
import type { InsertResource, Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, buildConflictUpdateColumns, eq, isNull, or } from "@ctrlplane/db";
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
const findExistingResources = async (
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

/**
 * Inserts or updates resources in the database. Note that this function only
 * handles the core resource fields - it does not insert/update associated
 * metadata or variables. Those must be handled separately.
 *
 * @param tx - Database transaction
 * @param resourcesToInsert - Array of resources to insert/update. Can include
 *                           metadata and variables but these will not be
 *                           persisted by this function.
 * @returns Promise resolving to array of inserted/updated resources, with any
 *          metadata/variables from the input merged onto the DB records
 */
export const insertResources = async (
  tx: Tx,
  resourcesToInsert: InsertResource[],
) => {
  const existingResources = await findExistingResources(tx, resourcesToInsert);
  const toDelete = existingResources.filter(
    (existing) =>
      !resourcesToInsert.some(
        (inserted) =>
          inserted.identifier === existing.identifier &&
          inserted.workspaceId === existing.workspaceId,
      ),
  );
  const insertedResources = await tx
    .insert(resource)
    .values(resourcesToInsert)
    .onConflictDoUpdate({
      target: [resource.identifier, resource.workspaceId],
      set: {
        ...buildConflictUpdateColumns(resource, [
          "name",
          "version",
          "kind",
          "config",
          "providerId",
        ]),
        updatedAt: new Date(),
        deletedAt: null,
      },
    })
    .returning();

  return { all: insertedResources, toDelete };
};
