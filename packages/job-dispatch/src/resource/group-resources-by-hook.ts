import type { Tx } from "@ctrlplane/db";
import type {
  InsertResource,
  Resource,
  ResourceMetadata,
  ResourceToUpsert,
  ResourceVariable,
} from "@ctrlplane/db/schema";
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
  tx.query.resource.findMany({
    where: and(eq(resource.providerId, providerId), isNull(resource.deletedAt)),
    with: { metadata: true, variables: true },
  });

const getResourcesByWorkspaceIdAndIdentifier = (
  tx: Tx,
  resources: { workspaceId: string; identifier: string }[],
) =>
  tx.query.resource.findMany({
    where: or(
      ...resources.map((r) =>
        and(
          eq(resource.workspaceId, r.workspaceId),
          eq(resource.identifier, r.identifier),
          isNull(resource.deletedAt),
        ),
      ),
    ),
    with: { metadata: true, variables: true },
  });

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
) => {
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

const isBaseFieldsUpdated = (
  existing: Resource,
  inserted: ResourceToUpsert,
) => {
  const requiredFields = [
    "identifier",
    "version",
    "name",
    "kind",
    "workspaceId",
  ];
  const existingRequired = _.pick(existing, requiredFields);
  const insertedRequired = _.pick(inserted, requiredFields);
  if (!_.isEqual(existingRequired, insertedRequired)) return true;

  const isProviderIdChanged =
    inserted.providerId !== undefined &&
    existing.providerId !== inserted.providerId;
  if (isProviderIdChanged) return true;

  const isConfigChanged =
    inserted.config != null && !_.isEqual(existing.config, inserted.config);
  if (isConfigChanged) return true;

  const isLockedAtChanged =
    inserted.lockedAt !== undefined && existing.lockedAt !== inserted.lockedAt;
  if (isLockedAtChanged) return true;

  const isCreatedAtChanged =
    inserted.createdAt !== undefined &&
    existing.createdAt !== inserted.createdAt;
  if (isCreatedAtChanged) return true;

  const isDeletedAtChanged =
    inserted.deletedAt !== undefined &&
    existing.deletedAt !== inserted.deletedAt;
  return isDeletedAtChanged;
};

const isResourceUpdated = (
  existing: Resource & {
    metadata: ResourceMetadata[];
    variables: ResourceVariable[];
  },
  inserted: ResourceToUpsert,
) => {
  const { metadata, variables } = existing;
  const { metadata: newMetadata, variables: newVariables } = inserted;

  if (isBaseFieldsUpdated(existing, inserted)) return true;

  const existingMetadata = Object.fromEntries(
    metadata.map((m) => [m.key, m.value]),
  );
  const isMetadataUpdated = !_.isEqual(existingMetadata, newMetadata);
  console.log({ existingMetadata, newMetadata });
  if (isMetadataUpdated) return true;

  const existingVarsMap = Object.fromEntries(
    variables.map((v) => [v.key, { value: v.value, sensitive: v.sensitive }]),
  );
  const newVarsMap = Object.fromEntries(
    (newVariables ?? []).map((v) => [
      v.key,
      { value: v.value, sensitive: v.sensitive },
    ]),
  );
  const isVariablesUpdated = !_.isEqual(existingVarsMap, newVarsMap);
  console.log({ existingVarsMap, newVarsMap, isVariablesUpdated });
  return isVariablesUpdated;
};

/**
 * Groups resources into categories based on what type of hook operation needs to be performed.
 * Compares input resources against existing database records to determine which resources
 * need to be created, updated, or deleted.
 *
 * @param tx - Database transaction
 * @param resourcesToUpsert - Array of resources to process and categorize
 * @returns {Object} Object containing three arrays of resources:
 *   - new: Resources that don't exist in the database and need to be created
 *   - upsert: Resources that exist and need to be updated
 *   - delete: Existing resources that are no longer present in the input and should be deleted
 */
export const groupResourcesByHook = async (
  tx: Tx,
  resourcesToUpsert: ResourceToUpsert[],
) => {
  const existingResources = await findExistingResources(tx, resourcesToUpsert);
  const toDelete = existingResources.filter(
    (existing) =>
      !resourcesToUpsert.some(
        (inserted) =>
          inserted.identifier === existing.identifier &&
          inserted.workspaceId === existing.workspaceId,
      ),
  );
  const toInsert = resourcesToUpsert.filter(
    (r) =>
      !existingResources.some(
        (er) =>
          er.identifier === r.identifier && er.workspaceId === r.workspaceId,
      ),
  );
  const toUpdate = resourcesToUpsert.filter((r) => {
    const existing = existingResources.find(
      (er) =>
        er.identifier === r.identifier && er.workspaceId === r.workspaceId,
    );
    if (existing == null) return false;

    return isResourceUpdated(existing, r);
  });

  console.log({ toInsert, toUpdate, toDelete });
  return { toInsert, toUpdate, toDelete };
};
