import type { Tx } from "@ctrlplane/db";
import type { InsertTarget, Target } from "@ctrlplane/db/schema";
import _ from "lodash";

import {
  and,
  buildConflictUpdateColumns,
  eq,
  inArray,
  isNotNull,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  environment,
  system,
  target,
  targetMatchesMetadata,
  targetMetadata,
} from "@ctrlplane/db/schema";
import { logger } from "@ctrlplane/logger";

import { dispatchJobsForNewTargets } from "./new-target.js";

const log = logger.child({ label: "upsert-targets" });

const getExistingTargets = (db: Tx, providerId: string) =>
  db.select().from(target).where(eq(target.providerId, providerId));

const dispatchNewTargets = async (db: Tx, newTargets: Target[]) => {
  const [firstTarget] = newTargets;
  if (firstTarget == null) return;

  const workspaceId = firstTarget.workspaceId;

  const workspaceEnvs = await db
    .select({ id: environment.id, targetFilter: environment.targetFilter })
    .from(environment)
    .innerJoin(system, eq(system.id, environment.systemId))
    .where(
      and(
        eq(system.workspaceId, workspaceId),
        isNotNull(environment.targetFilter),
      ),
    );

  const targetIds = newTargets.map((t) => t.id);
  for (const env of workspaceEnvs) {
    db.select()
      .from(target)
      .where(
        and(
          inArray(target.id, targetIds),
          targetMatchesMetadata(db, env.targetFilter),
        ),
      )
      .then((tgs) => {
        if (tgs.length === 0) return;
        dispatchJobsForNewTargets(
          db,
          tgs.map((t) => t.id),
          env.id,
        );
      });
  }
};

export const upsertTargets = async (
  tx: Tx,
  providerId: string,
  targetsToInsert: Array<InsertTarget & { metadata?: Record<string, string> }>,
) => {
  try {
    const targetsBeforeInsert = await getExistingTargets(tx, providerId);

    const duplicateTargetIdentifiers = _.chain(targetsToInsert)
      .groupBy((target) => [target.identifier, target.workspaceId])
      .filter((targets) => targets.length > 1)
      .map((targets) => targets[0]!.identifier)
      .value();

    if (duplicateTargetIdentifiers.length > 0) {
      const errorMessage = `Duplicate target identifiers found: ${duplicateTargetIdentifiers.join(
        ", ",
      )}`;
      logger.error(errorMessage);
      throw new Error(errorMessage);
    }

    const targets = await tx
      .insert(target)
      .values(targetsToInsert)
      .onConflictDoUpdate({
        target: [target.identifier, target.workspaceId],
        set: buildConflictUpdateColumns(target, [
          "name",
          "version",
          "kind",
          "config",
        ]),
      })
      .returning()
      .catch((err) => {
        log.error("Error inserting targets", { error: err });
        throw err;
      });

    const targetMetadataValues = targetsToInsert.flatMap((targetToInsert) => {
      const { identifier, workspaceId, metadata = [] } = targetToInsert;
      const targetId = targets.find(
        (t) => t.identifier === identifier && t.workspaceId === workspaceId,
      )?.id;
      if (targetId == null) return [];

      return Object.entries(metadata).map(([key, value]) => ({
        targetId,
        key,
        value,
      }));
    });

    const existingTargetMetadata = await tx
      .select()
      .from(targetMetadata)
      .where(
        inArray(
          targetMetadata.targetId,
          targets.map((t) => t.id),
        ),
      )
      .catch((err) => {
        log.error("Error fetching existing target metadata", { error: err });
        throw err;
      });

    const metadataToDelete = existingTargetMetadata.filter(
      (metadata) =>
        !targetMetadataValues.some(
          (newMetadata) =>
            newMetadata.targetId === metadata.targetId &&
            newMetadata.key === metadata.key,
        ),
    );

    await tx
      .insert(targetMetadata)
      .values(targetMetadataValues)
      .onConflictDoUpdate({
        target: [targetMetadata.targetId, targetMetadata.key],
        set: buildConflictUpdateColumns(targetMetadata, ["value"]),
      })
      .catch((err) => {
        log.error("Error inserting target metadata", { error: err });
        throw err;
      });

    await tx
      .delete(targetMetadata)
      .where(
        inArray(
          targetMetadata.id,
          metadataToDelete.map((m) => m.id),
        ),
      )
      .catch((err) => {
        log.error("Error deleting target metadata", { error: err });
        throw err;
      });

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
    log.info(
      `Found ${newTargetCount} new targets out of ${targetsToInsertCount} total targets`,
      {
        newTargetCount,
        targetsToInsertCount,
        targetsToDeleteCount: targetsToDelete.length,
        targetsBeforeInsertCount: targetsBeforeInsert.length,
      },
    );

    if (targetsToDelete.length > 0) {
      await tx
        .delete(target)
        .where(
          inArray(
            target.id,
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
