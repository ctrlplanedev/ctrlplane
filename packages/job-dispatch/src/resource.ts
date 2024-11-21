import type { Tx } from "@ctrlplane/db";
import type { InsertResource, Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNotNull,
  isNull,
  or,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  deploymentResourceRelationship,
  environment,
  resource,
  resourceMatchesMetadata,
  resourceMetadata,
  resourceRelationship,
  resourceVariable,
  system,
} from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

import { getEventsForResourceDeleted, handleEvent } from "./events/index.js";
import { dispatchJobsForNewResources } from "./new-resource.js";

const log = logger.child({ label: "upsert-resources" });

const isNotDeleted = isNull(resource.deletedAt);

const getExistingResourcesForProvider = (db: Tx, providerId: string) =>
  db
    .select()
    .from(resource)
    .where(and(eq(resource.providerId, providerId), isNotDeleted));

const dispatchChangedResources = async (
  db: Tx,
  workspaceId: string,
  resourceIds: string[],
) => {
  const workspaceEnvs = await db
    .select({ id: environment.id, resourceFilter: environment.resourceFilter })
    .from(environment)
    .innerJoin(system, eq(system.id, environment.systemId))
    .where(
      and(
        eq(system.workspaceId, workspaceId),
        isNotNull(environment.resourceFilter),
      ),
    );

  for (const env of workspaceEnvs) {
    db.select()
      .from(resource)
      .where(
        and(
          inArray(resource.id, resourceIds),
          resourceMatchesMetadata(db, env.resourceFilter),
          isNotDeleted,
        ),
      )
      .then((tgs) => {
        if (tgs.length === 0) return;
        dispatchJobsForNewResources(
          db,
          tgs.map((t) => t.id),
          env.id,
        );
      });
  }
};

type ResourceWithVariables = Resource & {
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

/**
 * Upserts resource variables for a list of resources. Updates existing
 * variables, adds new ones, and removes deleted ones. Encrypts sensitive
 * variable values before storing.
 *
 * @param tx - Database transaction
 * @param resources - Array of resources with their variables
 * @returns Array of resources that had their variables changed
 */
const upsertResourceVariables = async (
  tx: Tx,
  resources: Array<ResourceWithVariables>,
) => {
  const resourceIds = resources.map((r) => r.id);
  const existingResourceVariables = await tx
    .select()
    .from(resourceVariable)
    .where(inArray(resourceVariable.resourceId, resourceIds));

  const resourceVariablesValues = resources.flatMap(({ id, variables = [] }) =>
    variables.map(({ key, value, sensitive }) => ({
      resourceId: id,
      key,
      value: sensitive
        ? variablesAES256().encrypt(JSON.stringify(value))
        : value,
      sensitive,
    })),
  );

  // Track resources with added variables
  const resourcesWithAddedVars = new Set(
    resourceVariablesValues
      .filter(
        (newVar) =>
          !existingResourceVariables.some(
            (existing) =>
              existing.resourceId === newVar.resourceId &&
              existing.key === newVar.key,
          ),
      )
      .map((newVar) => newVar.resourceId),
  );

  // Track resources with modified variables
  const resourcesWithModifiedVars = new Set(
    resourceVariablesValues
      .filter((newVar) => {
        const existingVar = existingResourceVariables.find(
          (existing) =>
            existing.resourceId === newVar.resourceId &&
            existing.key === newVar.key,
        );
        return existingVar && existingVar.value !== newVar.value;
      })
      .map((newVar) => newVar.resourceId),
  );

  // Track resources with deleted variables
  const resourcesWithDeletedVars = new Set(
    existingResourceVariables
      .filter(
        (existingVar) =>
          !resourceVariablesValues.some(
            (newVar) =>
              newVar.resourceId === existingVar.resourceId &&
              newVar.key === existingVar.key,
          ),
      )
      .map((v) => v.resourceId),
  );

  const changedResources = new Set<string>([
    ...resourcesWithAddedVars,
    ...resourcesWithModifiedVars,
    ...resourcesWithDeletedVars,
  ]);

  if (resourceVariablesValues.length > 0)
    await tx
      .insert(resourceVariable)
      .values(resourceVariablesValues)
      .onConflictDoUpdate({
        target: [resourceVariable.key, resourceVariable.resourceId],
        set: buildConflictUpdateColumns(resourceVariable, [
          "value",
          "sensitive",
        ]),
      });

  const variablesToDelete = existingResourceVariables.filter(
    (variable) =>
      !resourceVariablesValues.some(
        (newVariable) =>
          newVariable.resourceId === variable.resourceId &&
          newVariable.key === variable.key,
      ),
  );

  if (variablesToDelete.length > 0)
    await tx
      .delete(resourceVariable)
      .where(
        inArray(
          resourceVariable.id,
          variablesToDelete.map((m) => m.id),
        ),
      )
      .catch((err) => {
        log.error("Error deleting resource variables", { error: err });
        throw err;
      });

  return changedResources;
};

type ResourceWithMetadata = Resource & { metadata?: Record<string, string> };

const upsertResourceMetadata = async (
  tx: Tx,
  resources: Array<ResourceWithMetadata>,
) => {
  const resourceIds = resources.map((r) => r.id);
  const existingResourceMetadata = await tx
    .select()
    .from(resourceMetadata)
    .where(inArray(resourceMetadata.resourceId, resourceIds));

  const resourceMetadataValues = resources.flatMap((resource) => {
    const { id, metadata = {} } = resource;

    return Object.entries(metadata).map(([key, value]) => ({
      resourceId: id,
      key,
      value,
    }));
  });

  const resourcesWithAddedMetadata = new Set(
    resourceMetadataValues
      .filter(
        (newMetadata) =>
          !existingResourceMetadata.some(
            (metadata) =>
              metadata.resourceId === newMetadata.resourceId &&
              metadata.key === newMetadata.key,
          ),
      )
      .map((metadata) => metadata.resourceId),
  );

  const resourcesWithDeletedMetadata = new Set(
    existingResourceMetadata
      .filter(
        (metadata) =>
          !resourceMetadataValues.some(
            (newMetadata) =>
              newMetadata.resourceId === metadata.resourceId &&
              newMetadata.key === metadata.key,
          ),
      )
      .map((metadata) => metadata.resourceId),
  );

  const resourcesWithUpdatedMetadata = new Set(
    resourceMetadataValues
      .filter((newMetadata) =>
        existingResourceMetadata.some(
          (metadata) =>
            metadata.resourceId === newMetadata.resourceId &&
            metadata.key === newMetadata.key &&
            metadata.value !== newMetadata.value,
        ),
      )
      .map((metadata) => metadata.resourceId),
  );

  const changedResources = new Set([
    ...resourcesWithAddedMetadata,
    ...resourcesWithUpdatedMetadata,
    ...resourcesWithDeletedMetadata,
  ]);

  if (resourceMetadataValues.length > 0)
    await tx
      .insert(resourceMetadata)
      .values(resourceMetadataValues)
      .onConflictDoUpdate({
        target: [resourceMetadata.resourceId, resourceMetadata.key],
        set: buildConflictUpdateColumns(resourceMetadata, ["value"]),
      })
      .catch((err) => {
        log.error("Error inserting resource metadata", { error: err });
        throw err;
      });

  const metadataToDelete = existingResourceMetadata.filter(
    (metadata) =>
      !resourceMetadataValues.some(
        (newMetadata) =>
          newMetadata.resourceId === metadata.resourceId &&
          newMetadata.key === metadata.key,
      ),
  );

  if (metadataToDelete.length > 0)
    await tx.delete(resourceMetadata).where(
      inArray(
        resourceMetadata.id,
        metadataToDelete.map((m) => m.id),
      ),
    );

  return changedResources;
};

export type ResourceToInsert = InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const upsertResources = async (
  tx: Tx,
  resourcesToInsert: ResourceToInsert[],
) => {
  const workspaceId = resourcesToInsert[0]?.workspaceId;
  if (workspaceId == null) throw new Error("Workspace ID is required");
  if (!resourcesToInsert.every((r) => r.workspaceId === workspaceId)) {
    throw new Error("All resources must belong to the same workspace");
  }

  try {
    // Get existing resources from the database, grouped by providerId.
    // - For resources without a providerId, look them up by workspaceId and
    //   identifier.
    // - For resources with a providerId, get all resources for that provider.
    log.info("Upserting resources", {
      resourcesToInsertCount: resourcesToInsert.length,
    });
    const resourcesBeforeInsertPromises = _.chain(resourcesToInsert)
      .groupBy((r) => r.providerId)
      .map(async (resources) => {
        const providerId = resources[0]?.providerId;

        return providerId == null
          ? db
              .select()
              .from(resource)
              .where(
                or(
                  ...resources.map((r) =>
                    and(
                      eq(resource.workspaceId, r.workspaceId),
                      eq(resource.identifier, r.identifier),
                      isNotDeleted,
                    ),
                  ),
                ),
              )
          : getExistingResourcesForProvider(tx, providerId);
      })
      .value();

    const resourcesBeforeInsert = await Promise.all(
      resourcesBeforeInsertPromises,
    ).then((r) => r.flat());

    const resources = await tx
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
      .returning()
      .then((resources) =>
        resources.map((r) => ({
          ...r,
          ...resourcesToInsert.find(
            (ri) =>
              ri.identifier === r.identifier &&
              ri.workspaceId === r.workspaceId,
          ),
        })),
      );

    const [changedResourcesMetadata, changedResourcesVariables] =
      await Promise.all([
        upsertResourceMetadata(tx, resources),
        upsertResourceVariables(tx, resources),
      ]);

    const changedResourceIds = new Set([
      ...Array.from(changedResourcesMetadata),
      ...Array.from(changedResourcesVariables),
    ]);

    const newResources = resources.filter(
      (r) =>
        !resourcesBeforeInsert.some((er) => er.identifier === r.identifier),
    );
    for (const resource of newResources) changedResourceIds.add(resource.id);

    log.info("new resources and providerId", {
      providerId: resourcesToInsert[0]?.providerId,
      newResources,
    });

    if (newResources.length > 0)
      await dispatchChangedResources(
        db,
        workspaceId,
        Array.from(changedResourceIds),
      );

    const resourcesToDelete = resourcesBeforeInsert.filter(
      (r) =>
        !resources.some(
          (newResource) => newResource.identifier === r.identifier,
        ),
    );

    const newResourceCount = newResources.length;
    const resourcesToInsertCount = resourcesToInsert.length;
    const resourcesToDeleteCount = resourcesToDelete.length;
    const resourcesBeforeInsertCount = resourcesBeforeInsert.length;
    log.info(
      `Found ${newResourceCount} new resources out of ${resourcesToInsertCount} total resources`,
      {
        newResourceCount,
        resourcesToInsertCount,
        resourcesToDeleteCount,
        resourcesBeforeInsertCount,
      },
    );

    if (resourcesToDelete.length > 0) {
      await deleteResources(tx, resourcesToDelete).catch((err) => {
        log.error("Error deleting resources", { error: err });
        throw err;
      });

      log.info(`Deleted ${resourcesToDelete.length} resources`, {
        resourcesToDelete,
      });
    }

    return resources;
  } catch (err) {
    log.error("Error upserting resources", { error: err });
    throw err;
  }
};

const deleteObjectsAssociatedWithResource = (tx: Tx, resource: Resource) =>
  Promise.all([
    tx
      .delete(resourceRelationship)
      .where(
        or(
          eq(resourceRelationship.sourceId, resource.id),
          eq(resourceRelationship.targetId, resource.id),
        ),
      ),
    tx
      .delete(deploymentResourceRelationship)
      .where(
        eq(
          deploymentResourceRelationship.resourceIdentifier,
          resource.identifier,
        ),
      ),
  ]);

/**
 * Delete resources from the database.
 *
 * @param tx - The transaction to use.
 * @param resourceIds - The ids of the resources to delete.
 */
export const deleteResources = async (tx: Tx, resources: Resource[]) => {
  const eventsPromises = Promise.all(
    resources.map(getEventsForResourceDeleted),
  );
  const events = await eventsPromises.then((res) => res.flat());
  await Promise.all(events.map(handleEvent));
  const resourceIds = resources.map((r) => r.id);
  const deleteAssociatedObjects = Promise.all(
    resources.map((r) => deleteObjectsAssociatedWithResource(tx, r)),
  );
  await Promise.all([
    deleteAssociatedObjects,
    tx
      .update(resource)
      .set({ deletedAt: new Date() })
      .where(inArray(resource.id, resourceIds)),
  ]);
};
