import type { Tx } from "@ctrlplane/db";
import type { InsertTarget } from "@ctrlplane/db/schema";
import _ from "lodash";

import {
  and,
  arrayContains,
  buildConflictUpdateColumns,
  inArray,
} from "@ctrlplane/db";
import { db } from "@ctrlplane/db/client";
import { environment, target } from "@ctrlplane/db/schema";

import { dispatchJobsForNewTargets } from "./new-target.js";

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
  const envs = await db
    .select()
    .from(environment)
    .innerJoin(target, arrayContains(target.labels, environment.targetFilter))
    .where(inArray(target.id, newTargetIds))
    .then((envs) =>
      _.chain(envs)
        .groupBy((e) => e.environment.id)
        .entries()
        .value(),
    );

  for (const [env, tgs] of envs) {
    dispatchJobsForNewTargets(
      db,
      tgs.map((t) => t.target.id),
      env,
    );
  }
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

  console.log(
    `Found ${newTargets.length} new targets out of ${upsertTargets.length} total targets`,
  );

  return targets;
};
