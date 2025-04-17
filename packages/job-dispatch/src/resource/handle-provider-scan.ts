import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";

import { selector, upsertResources } from "@ctrlplane/db";
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
  log.info(`Starting resource upsert: ${resourcesToInsert.length} resources`);
  try {
    const workspaceId = resourcesToInsert[0]?.workspaceId;
    if (workspaceId == null) throw new Error("Workspace ID is required");
    if (!resourcesToInsert.every((r) => r.workspaceId === workspaceId))
      throw new Error("All resources must belong to the same workspace");

    const { toInsert, toUpdate, toDelete } = await groupResourcesByHook(
      tx,
      resourcesToInsert,
    );
    log.info(
      `found ${toInsert.length} resources to insert and ${toUpdate.length} resources to update `,
    );
    const [insertedResources, updatedResources] = await Promise.all([
      upsertResources(tx, toInsert),
      upsertResources(tx, toUpdate),
    ]);

    log.info(
      `inserted ${insertedResources.length} resources and updated ${updatedResources.length} resources`,
    );

    const insertJobs = insertedResources.map((r) => ({ name: r.id, data: r }));
    const updateJobs = updatedResources.map((r) => ({ name: r.id, data: r }));
    const deleted = await deleteResources(tx, toDelete);

    await selector(tx).compute().allResourceSelectors(workspaceId);

    await getQueue(Channel.NewResource).addBulk(insertJobs);
    await getQueue(Channel.UpdatedResource).addBulk(updateJobs);

    log.info("completed handling resource provider scan");
    return { all: [...insertedResources, ...updatedResources], deleted };
  } catch (error) {
    log.error("Error upserting resources", { error });
    throw error;
  }
};
