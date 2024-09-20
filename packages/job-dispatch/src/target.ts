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

const getExistingTargets = (db: Tx, tgs: InsertTarget[]) =>
  db
    .select()
    .from(target)
    .where(
      and(
        inArray(
          target.identifier,
          tgs.map((t) => t.identifier),
        ),
        inArray(
          target.workspaceId,
          tgs.map((t) => t.workspaceId),
        ),
      ),
    );

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
  targetsToInsert: Array<InsertTarget & { metadata?: Record<string, string> }>,
) => {
  console.log(`>>> upserting ${targetsToInsert.length} targets`);
  const targetsBeforeInsert = await getExistingTargets(tx, targetsToInsert);

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
    .returning();

  const targetMetadataValues = targetsToInsert.flatMap((targetToInsert) => {
    const { identifier, workspaceId, metadata = [] } = targetToInsert;
    console.log(`>>> metadata for ${identifier}`, metadata);
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

  console.log(`>>> inserting ${targetMetadataValues.length} metadata values`);

  const existingTargetMetadata = await tx
    .select()
    .from(targetMetadata)
    .where(
      inArray(
        targetMetadata.targetId,
        targets.map((t) => t.id),
      ),
    );

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
    });

  await tx.delete(targetMetadata).where(
    inArray(
      targetMetadata.id,
      metadataToDelete.map((m) => m.id),
    ),
  );

  const newTargets = targets.filter(
    (t) => !targetsBeforeInsert.some((et) => et.identifier === t.identifier),
  );

  if (newTargets.length > 0) dispatchNewTargets(db, newTargets);

  const newTargetCount = newTargets.length;
  const targetsToInsertCount = targetsToInsert.length;
  log.info(
    `Found ${newTargetCount} new targets out of ${targetsToInsertCount} total targets`,
    { newTargetCount, targetsToInsertCount },
  );

  return targets;
};
