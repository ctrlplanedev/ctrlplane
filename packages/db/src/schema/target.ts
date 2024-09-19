import type { LabelCondition } from "@ctrlplane/validators/targets";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import { exists, like, or, sql } from "drizzle-orm";
import {
  json,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { and, eq } from "drizzle-orm/sql";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import type { Tx } from "../common.js";
import { targetProvider } from "./target-provider.js";
import { workspace } from "./workspace.js";

export const target = pgTable(
  "target",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    identifier: text("identifier").notNull(),
    providerId: uuid("provider_id").references(() => targetProvider.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    config: jsonb("config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => ({ uniq: uniqueIndex().on(t.identifier, t.workspaceId) }),
);

export type Target = InferSelectModel<typeof target>;

export const createTarget = createInsertSchema(target, {
  version: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  providerId: z.string().uuid(),
  config: z.record(z.any()),
}).omit({ id: true });

export type InsertTarget = InferInsertModel<typeof target>;

export const updateTarget = createTarget.partial();

export const targetSchema = pgTable(
  "target_schema",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id),
    version: text("version").notNull(),
    kind: text("kind").notNull(),
    jsonSchema: json("json_schema").notNull().$type<Record<string, any>>(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.version, t.kind, t.workspaceId) }),
);

export const targetLabel = pgTable(
  "target_label",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    targetId: uuid("target_id")
      .references(() => target.id, { onDelete: "cascade" })
      .notNull(),

    label: text("label").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.label, t.targetId) }),
);

const buildCondition = (tx: Tx, cond: LabelCondition): SQL => {
  if (cond.operator === "regex")
    return exists(
      tx
        .select()
        .from(targetLabel)
        .where(
          and(
            eq(targetLabel.targetId, target.id),
            eq(targetLabel.label, cond.label),
            sql`${targetLabel.value} ~ ${cond.pattern}`,
          ),
        ),
    );

  if (cond.operator === "like")
    return exists(
      tx
        .select()
        .from(targetLabel)
        .where(
          and(
            eq(targetLabel.targetId, target.id),
            eq(targetLabel.label, cond.label),
            like(targetLabel.value, cond.pattern),
          ),
        ),
    );

  if (cond.operator === "and" || cond.operator === "or") {
    const subCon = cond.conditions.map((c) => buildCondition(tx, c));
    return cond.operator === "and" ? and(...subCon)! : or(...subCon)!;
  }

  if ("value" in cond)
    return exists(
      tx
        .select()
        .from(targetLabel)
        .where(
          and(
            eq(targetLabel.targetId, target.id),
            eq(targetLabel.label, cond.label),
            eq(targetLabel.value, cond.value),
          ),
        ),
    );

  throw Error("invalid label conditions");
};

export function targetMatchsLabel(
  tx: Tx,
  labels?: LabelCondition | null,
): SQL<unknown> | undefined {
  return labels == null || Object.keys(labels).length === 0
    ? undefined
    : buildCondition(tx, labels);
}
