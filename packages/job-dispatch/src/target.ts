import type { Tx } from "@ctrlplane/db";
import type { InsertTarget } from "@ctrlplane/db/schema";
import _ from "lodash";

import { and, buildConflictUpdateColumns, eq, inArray } from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import {
  environment,
  system,
  target,
  targetLabel,
  targetMatchsLabel,
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

const dispatchNewTargets = async (db: Tx, newTargetIds: string[]) => {
  const targets = await db
    .select({
      workspaceId: target.workspaceId,
    })
    .from(target)
    .leftJoin(targetLabel, eq(targetLabel.targetId, target.id))
    .where(inArray(target.id, newTargetIds));

  const envs = await db
    .select()
    .from(environment)
    .innerJoin(system, eq(environment.systemId, system.id))
    .where(
      inArray(
        system.workspaceId,
        targets.map((t) => t.workspaceId),
      ),
    );

  await Promise.all(
    envs.map((env) =>
      db
        .select()
        .from(target)
        .where(
          and(
            inArray(target.id, newTargetIds),
            eq(target.workspaceId, env.system.workspaceId),
            targetMatchsLabel(db, env.environment.targetFilter),
          ),
        )
        .then((tgs) =>
          dispatchJobsForNewTargets(
            db,
            tgs.map((t) => t.id),
            env.environment.id,
          ),
        ),
    ),
  );
};

export const upsertTargets = async (
  tx: Tx,
  targetsToInsert: InsertTarget[],
) => {
  const targetsBeforeInsert = await getExistingTargets(tx, targetsToInsert);

  const targets = await tx
    .insert(target)
    .values(targetsToInsert)
    .onConflictDoUpdate({
      target: [target.identifier, target.workspaceId],
      set: buildConflictUpdateColumns(target, ["labels"]),
    })
    .returning();

  const newTargets = targets.filter(
    (t) => !targetsBeforeInsert.some((et) => et.identifier === t.identifier),
  );

  if (newTargets.length > 0)
    dispatchNewTargets(
      db,
      newTargets.map((t) => t.id),
    );

  const newTargetCount = newTargets.length;
  const targetsToInsertCount = targetsToInsert.length;
  log.info(
    `Found ${newTargetCount} new targets out of ${targetsToInsertCount} total targets`,
    { newTargetCount, targetsToInsertCount },
  );

  return targets;
};
