import type { Tx } from "@ctrlplane/db";
import type { InsertResource, Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, eq, inArray, isNull, or } from "@ctrlplane/db";
import { resource } from "@ctrlplane/db/schema";

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
  workspaceId: string,
  providerId: string,
  resourceIdentifiers: string[],
): Promise<Resource[]> => {
  const existingResources = await tx.query.resource.findMany({
    where: and(
      eq(resource.workspaceId, workspaceId),
      or(
        eq(resource.providerId, providerId),
        inArray(resource.identifier, resourceIdentifiers),
      ),
      isNull(resource.deletedAt),
    ),
  });
  return existingResources;
};

/**
 * Groups resources into categories based on what type of hook operation needs to be performed.
 * Compares input resources against existing database records to determine which resources
 * need to be created, updated, or deleted.
 *
 * @param tx - Database transaction
 * @param resourcesToInsert - Array of resources to process and categorize
 * @returns {Object} Object containing three arrays of resources:
 *   - new: Resources that don't exist in the database and need to be created
 *   - upsert: Resources that exist and need to be updated
 *   - delete: Existing resources that are no longer present in the input and should be deleted
 */
export const groupResourcesByHook = async (
  tx: Tx,
  workspaceId: string,
  providerId: string,
  resourcesToInsert: Omit<InsertResource, "providerId" | "workspaceId">[],
) => {
  const existingResources = await findExistingResources(
    tx,
    workspaceId,
    providerId,
    resourcesToInsert.map((r) => r.identifier),
  );

  // Resources that belong to other providers should be ignored
  const toIgnore = existingResources.filter(
    (r) => r.providerId !== providerId && r.providerId != null,
  );

  // Resources we can actually operate on (not owned by other providers)
  const actionableExistingResources = existingResources.filter(
    (r) => !toIgnore.some((ignored) => ignored.identifier === r.identifier),
  );

  // Resources that exist in DB but not in the new set should be deleted
  const toDelete = actionableExistingResources.filter(
    (existing) =>
      !resourcesToInsert.some((r) => r.identifier === existing.identifier),
  );

  // Resources in the new set that don't exist in DB should be inserted
  const toInsert = resourcesToInsert.filter(
    (r) =>
      !existingResources.some((er) => er.identifier === r.identifier) &&
      !toIgnore.some((ignored) => ignored.identifier === r.identifier),
  );

  // Resources that exist in both sets should be updated
  const toUpdate = resourcesToInsert.filter((r) =>
    actionableExistingResources.some((er) => er.identifier === r.identifier),
  );

  return { toIgnore, toInsert, toUpdate, toDelete };
};
