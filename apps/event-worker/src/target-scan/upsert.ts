import type { Tx } from "@ctrlplane/db";
import type { Target } from "@ctrlplane/db/schema";

import { buildConflictUpdateColumns, sql } from "@ctrlplane/db";
import { target } from "@ctrlplane/db/schema";

export type UpsertTarget = Pick<
  Target,
  | "version"
  | "name"
  | "kind"
  | "config"
  | "labels"
  | "providerId"
  | "identifier"
  | "workspaceId"
>;

export const upsertTargets = (db: Tx, providerId: string, ts: UpsertTarget[]) =>
  db
    .insert(target)
    .values(ts)
    .onConflictDoUpdate({
      target: [target.identifier, target.workspaceId],
      setWhere: sql`target.provider_id = ${providerId}`,
      set: buildConflictUpdateColumns(target, ["labels"]),
    })
    .returning();
