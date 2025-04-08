import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";

import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { deleteResources } from "./delete.js";
import { insertResourceMetadata } from "./insert-resource-metadata.js";
import { insertResourceVariables } from "./insert-resource-variables.js";
import { insertResources } from "./insert-resources.js";

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
  try {
    const workspaceId = resourcesToInsert[0]?.workspaceId;
    if (workspaceId == null) throw new Error("Workspace ID is required");
    if (!resourcesToInsert.every((r) => r.workspaceId === workspaceId))
      throw new Error("All resources must belong to the same workspace");

    const { all, toDelete } = await insertResources(tx, resourcesToInsert);

    const resourcesWithId = all.map((r) => ({
      ...r,
      ...resourcesToInsert.find(
        (ri) =>
          ri.identifier === r.identifier && ri.workspaceId === r.workspaceId,
      ),
    }));

    await Promise.all([
      insertResourceVariables(tx, resourcesWithId),
      insertResourceMetadata(tx, resourcesWithId),
    ]);

    await getQueue(Channel.ProcessUpsertedResource).addBulk(
      all.map((r) => ({
        name: r.id,
        data: r,
      })),
    );

    const deleted = await deleteResources(tx, toDelete);
    return { all, deleted };
  } catch (error) {
    log.error("Error upserting resources", { error });
    throw error;
  }
};
