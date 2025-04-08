import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { dbUpsertResource } from "./db-upsert-resource.js";
import { deleteResource } from "./delete-resource.js";
import { findExistingResources } from "./find-existing-resources.js";

const log = logger.child({ label: "upsert-resources" });

export type ResourceToInsert = InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};

export const upsertResources = async (
  tx: Tx,
  resourcesToInsert: ResourceToInsert[],
) => {
  log.info("Starting resource upsert", {
    count: resourcesToInsert.length,
    identifiers: resourcesToInsert.map((r) => r.identifier),
  });

  const workspaceId = resourcesToInsert[0]?.workspaceId;
  if (workspaceId == null) throw new Error("Workspace ID is required");
  if (!resourcesToInsert.every((r) => r.workspaceId === workspaceId))
    throw new Error("All resources must belong to the same workspace");

  const existingResources = await findExistingResources(tx, resourcesToInsert);
  const resourcesToDelete = existingResources.filter(
    (existing) =>
      !resourcesToInsert.some(
        (inserted) =>
          inserted.identifier === existing.identifier &&
          inserted.workspaceId === existing.workspaceId,
      ),
  );

  const resources = await Promise.all(
    resourcesToInsert.map((r) => dbUpsertResource(tx, r)),
  );

  const addToUpsertQueuePromise = getQueue(
    Channel.ProcessUpsertedResource,
  ).addBulk(
    resources.map((r) => ({
      name: r.id,
      data: r,
    })),
  );

  const deleteResourcesPromise = Promise.all(
    resourcesToDelete.map((r) => deleteResource(tx, r.id)),
  );

  const [, deletedResources] = await Promise.all([
    addToUpsertQueuePromise,
    deleteResourcesPromise,
  ]);

  return { all: resources, deleted: deletedResources };
};
