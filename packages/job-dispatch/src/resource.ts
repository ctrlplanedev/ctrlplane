import type { Tx } from "@ctrlplane/db";
import type { InsertResource, Resource } from "@ctrlplane/db/schema";
import _ from "lodash";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNotNull,
  or,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  environment,
  resource,
  resourceMatchesMetadata,
  resourceMetadata,
  resourceVariable,
  system,
} from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { variablesAES256 } from "@ctrlplane/secrets";

import { dispatchJobsForNewResources } from "./new-resource.js";

const log = logger.child({ label: "upsert-resources" });

const getExistingResourcesForProvider = (db: Tx, providerId: string) =>
  db.select().from(resource).where(eq(resource.providerId, providerId));

const dispatchNewResources = async (db: Tx, newResources: Resource[]) => {
  const [firstResource] = newResources;
  if (firstResource == null) return;

  const workspaceId = firstResource.workspaceId;

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

  const resourceIds = newResources.map((r) => r.id);
  for (const env of workspaceEnvs) {
    db.select()
      .from(resource)
      .where(
        and(
          inArray(resource.id, resourceIds),
          resourceMatchesMetadata(db, env.resourceFilter),
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

const upsertResourceVariables = async (
  tx: Tx,
  resources: Array<
    Resource & {
      variables?: Array<{ key: string; value: any; sensitive: boolean }>;
    }
  >,
) => {
  const existingResourceVariables = await tx
    .select()
    .from(resourceVariable)
    .where(
      inArray(
        resourceVariable.resourceId,
        resources.map((r) => r.id),
      ),
    )
    .catch((err) => {
      log.error("Error fetching existing resource variables", { error: err });
      throw err;
    });

  const resourceVariablesValues = resources.flatMap((resource) => {
    const { id, variables = [] } = resource;
    return variables.map(({ key, value, sensitive }) => ({
      resourceId: id,
      key,
      value: sensitive
        ? variablesAES256().encrypt(JSON.stringify(value))
        : value,
      sensitive,
    }));
  });

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
      })
      .catch((err) => {
        log.error("Error inserting resource variables", { error: err });
        throw err;
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
};

const upsertResourceMetadata = async (
  tx: Tx,
  resources: Array<Resource & { metadata?: Record<string, string> }>,
) => {
  const existingResourceMetadata = await tx
    .select()
    .from(resourceMetadata)
    .where(
      inArray(
        resourceMetadata.resourceId,
        resources.map((r) => r.id),
      ),
    )
    .catch((err) => {
      log.error("Error fetching existing resource metadata", { error: err });
      throw err;
    });

  const resourceMetadataValues = resources.flatMap((resource) => {
    const { id, metadata = {} } = resource;

    return Object.entries(metadata).map(([key, value]) => ({
      resourceId: id,
      key,
      value,
    }));
  });

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
    await tx
      .delete(resourceMetadata)
      .where(
        inArray(
          resourceMetadata.id,
          metadataToDelete.map((m) => m.id),
        ),
      )
      .catch((err) => {
        log.error("Error deleting resource metadata", { error: err });
        throw err;
      });
};

export type ResourceToInsert = InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const upsertResources = async (
  tx: Tx,
  resourcesToInsert: ResourceToInsert[],
) => {
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
      .filter((r) => r[0]?.providerId != null)
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
          ]),
          updatedAt: new Date(),
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
      )
      .catch((err) => {
        log.error("Error inserting resources", { error: err });
        throw err;
      });

    await Promise.all([
      upsertResourceMetadata(tx, resources),
      upsertResourceVariables(tx, resources),
    ]);

    const newResources = resources.filter(
      (r) =>
        !resourcesBeforeInsert.some((er) => er.identifier === r.identifier),
    );

    if (newResources.length > 0)
      await dispatchNewResources(db, newResources).catch((err) => {
        log.error("Error dispatching new resources", { error: err });
        throw err;
      });

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
      await tx
        .delete(resource)
        .where(
          inArray(
            resource.id,
            resourcesToDelete.map((r) => r.id),
          ),
        )
        .catch((err) => {
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
