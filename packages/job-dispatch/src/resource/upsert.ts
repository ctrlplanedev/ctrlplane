import type { Tx } from "@ctrlplane/db";
import type { InsertResource } from "@ctrlplane/db/schema";
import _ from "lodash";

import { logger } from "@ctrlplane/logger";

import { deleteResources } from "./delete.js";
import {
  dispatchEventsForRemovedResources,
  dispatchJobsForAddedResources,
} from "./dispatch-resource.js";
import { insertResourceMetadata } from "./insert-resource-metadata.js";
import { insertResourceVariables } from "./insert-resource-variables.js";
import { insertResources } from "./insert-resources.js";
import { getEnvironmentsByResourceWithIdentifiers } from "./utils.js";

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

  try {
    const resourceIdentifiers = resourcesToInsert.map((r) => r.identifier);
    log.info("Getting environments before insert", { resourceIdentifiers });
    const envsBeforeInsert = await getEnvironmentsByResourceWithIdentifiers(
      tx,
      workspaceId,
      resourceIdentifiers,
    );

    log.debug("Envs before insert", {
      envs: envsBeforeInsert.map((e) => ({
        id: e.id,
        resources: e.resources.map((r) => r.identifier),
      })),
    });

    log.debug("Inserting resources");
    const resources = await insertResources(tx, resourcesToInsert);
    const resourcesWithId = resources.all.map((r) => ({
      ...r,
      ...resourcesToInsert.find(
        (ri) =>
          ri.identifier === r.identifier && ri.workspaceId === r.workspaceId,
      ),
    }));

    log.debug("Inserting resource metadata and variables");
    const [, updatedVariableResourceIds] = await Promise.all([
      insertResourceMetadata(tx, resourcesWithId),
      insertResourceVariables(tx, resourcesWithId),
    ]);

    log.debug("Getting environments after insert");
    const envsAfterInsert = await getEnvironmentsByResourceWithIdentifiers(
      tx,
      workspaceId,
      resourceIdentifiers,
    );

    log.debug("Envs after insert", {
      envs: envsAfterInsert.map((e) => ({
        id: e.id,
        resources: e.resources.map((r) => r.identifier),
      })),
    });
    const envVariableChangePromises = envsAfterInsert.map((env) =>
      dispatchJobsForAddedResources(
        tx,
        env.resources
          .filter((r) => updatedVariableResourceIds.has(r.id))
          .map((r) => r.id),
        env.id,
      ),
    );
    await Promise.all(envVariableChangePromises);
    const changedEnvs = envsAfterInsert.map((env) => {
      const beforeEnv = envsBeforeInsert.find((e) => e.id === env.id);
      const beforeResources = beforeEnv?.resources ?? [];
      const afterResources = env.resources;
      const removedResources = beforeResources.filter(
        (br) => !afterResources.some((ar) => ar.id === br.id),
      );
      const addedResources = afterResources.filter(
        (ar) => !beforeResources.some((br) => br.id === ar.id),
      );
      return { ...env, removedResources, addedResources };
    });

    const deletedResourceIds = new Set(resources.deleted.map((r) => r.id));
    if (resources.deleted.length > 0) {
      log.info("Deleting resources", { count: resources.deleted.length });
      await deleteResources(tx, resources.deleted).catch((err) => {
        log.error("Error deleting resources", { error: err });
        throw err;
      });
    }

    for (const env of changedEnvs) {
      if (env.addedResources.length > 0) {
        log.info("Dispatching jobs for added resources", {
          envId: env.id,
          count: env.addedResources.length,
        });
        await dispatchJobsForAddedResources(
          tx,
          env.addedResources
            .map((r) => r.id)
            .filter((r) => !updatedVariableResourceIds.has(r)),
          env.id,
        );
      }

      if (env.removedResources.length > 0) {
        const removedIds = env.removedResources
          .map((r) => r.id)
          .filter((id) => !deletedResourceIds.has(id));

        if (removedIds.length > 0) {
          log.info("Dispatching hook events for removed resources", {
            envId: env.id,
            count: removedIds.length,
          });
          await dispatchEventsForRemovedResources(tx, removedIds, env);
        }
      }
    }

    log.info("Resource upsert completed successfully", {
      added: resources.all.length,
      deleted: resources.deleted.length,
    });
    return resources;
  } catch (err) {
    log.error("Error upserting resources", { error: err });
    throw err;
  }
};
