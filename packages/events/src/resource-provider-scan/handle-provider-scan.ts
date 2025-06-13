import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";

import {
  and,
  eq,
  inArray,
  isResourceChanged,
  upsertResources,
} from "@ctrlplane/db";
import * as schema from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";
import { getAffectedVariables } from "@ctrlplane/rule-engine";

import { dispatchQueueJob } from "../dispatch-jobs.js";
import { getQueue } from "../index.js";
import { Channel } from "../types.js";
import { groupResourcesByHook } from "./group-resources-by-hook.js";

const log = logger.child({ label: "upsert-resources" });

export type ResourceToInsert = Omit<
  InsertResource,
  "providerId" | "workspaceId"
> & {
  metadata?: Record<string, string>;
  variables?: Array<
    | { key: string; value: any; sensitive: boolean }
    | { key: string; reference: string; path: string[]; defaultValue?: any }
  >;
};

const getPreviousResources = async (
  tx: Tx,
  workspaceId: string,
  toUpdate: ResourceToInsert[],
) =>
  toUpdate.length > 0
    ? await tx.query.resource.findMany({
        where: and(
          inArray(
            schema.resource.identifier,
            toUpdate.map((r) => r.identifier),
          ),
          eq(schema.resource.workspaceId, workspaceId),
        ),
        with: { variables: true, metadata: true },
      })
    : [];

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

    const previousResources = await getPreviousResources(
      tx,
      workspaceId,
      toUpdate,
    );

    const previousVariables = Object.fromEntries(
      previousResources.map((r) => [r.identifier, r.variables]),
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

    if (toDelete.length > 0)
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
    const deleteJobs = toDelete.map((r) => ({ name: r.id, data: r }));
    const changedResources = updatedResources.filter((r) => {
      const previous = previousResources.find(
        (pr) =>
          pr.identifier === r.identifier && pr.workspaceId === r.workspaceId,
      );
      if (previous == null) return true;
      return isResourceChanged(previous, r);
    });

    await getQueue(Channel.DeleteResource).addBulk(deleteJobs);
    await getQueue(Channel.NewResource).addBulk(insertJobs);
    if (changedResources.length > 0)
      await dispatchQueueJob().toUpdatedResource(changedResources);

    for (const resource of insertedResources) {
      const { variables } = resource;
      for (const variable of variables)
        await getQueue(Channel.UpdateResourceVariable).add(
          variable.id,
          variable,
        );
    }

    for (const resource of updatedResources) {
      const { variables } = resource;
      const previousVars = previousVariables[resource.identifier] ?? [];

      const affectedVariables = getAffectedVariables(previousVars, variables);
      for (const variable of affectedVariables)
        await getQueue(Channel.UpdateResourceVariable).add(
          variable.id,
          variable,
        );
    }

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
