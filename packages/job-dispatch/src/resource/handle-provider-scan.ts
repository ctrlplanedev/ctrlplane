import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";

import { upsertResources } from "@ctrlplane/db";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { deleteResources } from "./delete.js";
import { groupResourcesByHook } from "./group-resources-by-hook.js";

const log = logger.child({ label: "upsert-resources" });

export type ResourceToInsert = InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};
export const handleResourceProviderScan = async (
  tx: Tx,
  resourcesToInsert: ResourceToInsert[],
) => {
  log.info("Starting resource upsert", {
    count: resourcesToInsert.length,
    identifiers: resourcesToInsert.map((r) => r.identifier),
  });
  try {
    const workspaceId = resourcesToInsert[0]?.workspaceId;
    if (workspaceId == null) throw new Error("Workspace ID is required");
    if (!resourcesToInsert.every((r) => r.workspaceId === workspaceId))
      throw new Error("All resources must belong to the same workspace");

    const { newResources, toUpsert, toDelete } = await groupResourcesByHook(
      tx,
      resourcesToInsert,
    );
    const insertedResources = await upsertResources(tx, newResources);
    const upsertedResources = await upsertResources(tx, toUpsert);

    await getQueue(Channel.UpsertedResource).addBulk(
      insertedResources.map((r) => ({
        name: r.id,
        data: r,
      })),
    );

    await getQueue(Channel.UpsertedResource).addBulk(
      upsertedResources.map((r) => ({
        name: r.id,
        data: r,
      })),
    );

    const deleted = await deleteResources(tx, toDelete);
    return { all: [...insertedResources, ...upsertedResources], deleted };
  } catch (error) {
    log.error("Error upserting resources", { error });
    throw error;
  }
};
