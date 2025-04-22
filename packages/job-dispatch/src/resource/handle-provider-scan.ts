import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";

import { inArray, upsertResources } from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { Channel, getQueue } from "@ctrlplane/events";
import { logger } from "@ctrlplane/logger";

import { groupResourcesByHook } from "./group-resources-by-hook.js";

const log = logger.child({ label: "upsert-resources" });

export type ResourceToInsert = Omit<
  InsertResource,
  "providerId" | "workspaceId"
> & {
  metadata?: Record<string, string>;
  variables?: Array<{ key: string; value: any; sensitive: boolean }>;
};
export const handleResourceProviderScan = async (
  tx: Tx,
  workspaceId: string,
  providerId: string,
  resourcesToInsert: ResourceToInsert[],
) => {
  log.info(`Starting resource upsert: ${resourcesToInsert.length} resources`);
  try {
    const { toIgnore, toInsert, toUpdate, toDelete } =
      await groupResourcesByHook(
        tx,
        workspaceId,
        providerId,
        resourcesToInsert,
      );
    log.info(
      `found ${toInsert.length} resources to insert and ${toUpdate.length} resources to update `,
    );

    const [insertedResources, updatedResources] = await Promise.all([
      upsertResources(
        tx,
        workspaceId,
        toInsert.map((r) => ({ ...r, providerId })),
      ),
      upsertResources(
        tx,
        workspaceId,
        toUpdate.map((r) => ({ ...r, providerId })),
      ),
    ]);

    log.info(
      `inserted ${insertedResources.length} resources and updated ${updatedResources.length} resources`,
    );

    await tx
      .update(schema.resource)
      .set({ deletedAt: new Date() })
      .where(
        inArray(
          schema.resource.id,
          toDelete.map((r) => r.id),
        ),
      );

    const insertJobs = insertedResources.map((r) => ({ name: r.id, data: r }));
    const updateJobs = updatedResources.map((r) => ({ name: r.id, data: r }));
    const deleteJobs = toDelete.map((r) => ({ name: r.id, data: r }));

    await getQueue(Channel.DeleteResource).addBulk(deleteJobs);
    await getQueue(Channel.NewResource).addBulk(insertJobs);
    await getQueue(Channel.UpdatedResource).addBulk(updateJobs);

    log.info("completed handling resource provider scan");
    return {
      ignored: toIgnore,
      inserted: insertedResources,
      updated: updatedResources,
      deleted: toDelete,
    };
  } catch (error) {
    log.error("Error upserting resources", { error });
    throw error;
  }
};
