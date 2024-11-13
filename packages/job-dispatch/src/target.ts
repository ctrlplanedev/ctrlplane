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

import { dispatchJobsForNewResources } from "./new-target.js";

const log = logger.child({ label: "upsert-targets" });

const getExistingTargetsForProvider = (db: Tx, providerId: string) =>
  db.select().from(resource).where(eq(resource.providerId, providerId));

const dispatchNewTargets = async (db: Tx, newTargets: Resource[]) => {
  const [firstTarget] = newTargets;
  if (firstTarget == null) return;

  const workspaceId = firstTarget.workspaceId;

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

  const targetIds = newTargets.map((t) => t.id);
  for (const env of workspaceEnvs) {
    db.select()
      .from(resource)
      .where(
        and(
          inArray(resource.id, targetIds),
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

const upsertTargetVariables = async (
  tx: Tx,
  targets: Array<
    Resource & {
      variables?: Array<{ key: string; value: any; sensitive: boolean }>;
    }
  >,
) => {
  const existingTargetVariables = await tx
    .select()
    .from(resourceVariable)
    .where(
      inArray(
        resourceVariable.resourceId,
        targets.map((t) => t.id),
      ),
    )
    .catch((err) => {
      log.error("Error fetching existing target metadata", { error: err });
      throw err;
    });

  const targetVariablesValues = targets.flatMap((target) => {
    const { id, variables = [] } = target;
    return variables.map(({ key, value, sensitive }) => ({
      resourceId: id,
      key,
      value: sensitive
        ? variablesAES256().encrypt(JSON.stringify(value))
        : value,
      sensitive,
    }));
  });

  if (targetVariablesValues.length > 0)
    await tx
      .insert(resourceVariable)
      .values(targetVariablesValues)
      .onConflictDoUpdate({
        target: [resourceVariable.key, resourceVariable.resourceId],
        set: buildConflictUpdateColumns(resourceVariable, [
          "value",
          "sensitive",
        ]),
      })
      .catch((err) => {
        log.error("Error inserting target variables", { error: err });
        throw err;
      });

  const variablesToDelete = existingTargetVariables.filter(
    (variable) =>
      !targetVariablesValues.some(
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
        log.error("Error deleting target variables", { error: err });
        throw err;
      });
};

const upsertTargetMetadata = async (
  tx: Tx,
  targets: Array<Resource & { metadata?: Record<string, string> }>,
) => {
  const existingTargetMetadata = await tx
    .select()
    .from(resourceMetadata)
    .where(
      inArray(
        resourceMetadata.resourceId,
        targets.map((t) => t.id),
      ),
    )
    .catch((err) => {
      log.error("Error fetching existing target metadata", { error: err });
      throw err;
    });

  const targetMetadataValues = targets.flatMap((target) => {
    const { id, metadata = {} } = target;

    return Object.entries(metadata).map(([key, value]) => ({
      resourceId: id,
      key,
      value,
    }));
  });

  if (targetMetadataValues.length > 0)
    await tx
      .insert(resourceMetadata)
      .values(targetMetadataValues)
      .onConflictDoUpdate({
        target: [resourceMetadata.resourceId, resourceMetadata.key],
        set: buildConflictUpdateColumns(resourceMetadata, ["value"]),
      })
      .catch((err) => {
        log.error("Error inserting target metadata", { error: err });
        throw err;
      });

  const metadataToDelete = existingTargetMetadata.filter(
    (metadata) =>
      !targetMetadataValues.some(
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
        log.error("Error deleting target metadata", { error: err });
        throw err;
      });
};

export const upsertTargets = async (
  tx: Tx,
  targetsToInsert: Array<
    InsertResource & {
      metadata?: Record<string, string>;
      variables?: Array<{ key: string; value: any; sensitive: boolean }>;
    }
  >,
) => {
  try {
    // Get existing targets from the database, grouped by providerId.
    // - For targets without a providerId, look them up by workspaceId and
    //   identifier.
    // - For targets with a providerId, get all targets for that provider.
    log.info("Upserting targets", {
      targetsToInsertCount: targetsToInsert.length,
    });
    const targetsBeforeInsertPromises = _.chain(targetsToInsert)
      .groupBy((t) => t.providerId)
      .filter((t) => t[0]?.providerId != null)
      .map(async (targets) => {
        const providerId = targets[0]?.providerId;

        return providerId == null
          ? db
              .select()
              .from(resource)
              .where(
                or(
                  ...targets.map((t) =>
                    and(
                      eq(resource.workspaceId, t.workspaceId),
                      eq(resource.identifier, t.identifier),
                    ),
                  ),
                ),
              )
          : getExistingTargetsForProvider(tx, providerId);
      })
      .value();

    const targetsBeforeInsert = await Promise.all(
      targetsBeforeInsertPromises,
    ).then((r) => r.flat());

    const targets = await tx
      .insert(resource)
      .values(targetsToInsert)
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
      .then((targets) =>
        targets.map((t) => ({
          ...t,
          ...targetsToInsert.find(
            (ti) =>
              ti.identifier === t.identifier &&
              ti.workspaceId === t.workspaceId,
          ),
        })),
      )
      .catch((err) => {
        log.error("Error inserting targets", { error: err });
        throw err;
      });

    await Promise.all([
      upsertTargetMetadata(tx, targets),
      upsertTargetVariables(tx, targets),
    ]);

    const newTargets = targets.filter(
      (t) => !targetsBeforeInsert.some((et) => et.identifier === t.identifier),
    );

    if (newTargets.length > 0)
      await dispatchNewTargets(db, newTargets).catch((err) => {
        log.error("Error dispatching new targets", { error: err });
        throw err;
      });

    const targetsToDelete = targetsBeforeInsert.filter(
      (t) =>
        !targets.some((newTarget) => newTarget.identifier === t.identifier),
    );

    const newTargetCount = newTargets.length;
    const targetsToInsertCount = targetsToInsert.length;
    const targetsToDeleteCount = targetsToDelete.length;
    const targetsBeforeInsertCount = targetsBeforeInsert.length;
    log.info(
      `Found ${newTargetCount} new targets out of ${targetsToInsertCount} total targets`,
      {
        newTargetCount,
        targetsToInsertCount,
        targetsToDeleteCount,
        targetsBeforeInsertCount,
      },
    );

    if (targetsToDelete.length > 0) {
      await tx
        .delete(resource)
        .where(
          inArray(
            resource.id,
            targetsToDelete.map((t) => t.id),
          ),
        )
        .catch((err) => {
          log.error("Error deleting targets", { error: err });
          throw err;
        });

      log.info(`Deleted ${targetsToDelete.length} targets`, {
        targetsToDelete,
      });
    }

    return targets;
  } catch (err) {
    log.error("Error upserting targets", { error: err });
    throw err;
  }
};
