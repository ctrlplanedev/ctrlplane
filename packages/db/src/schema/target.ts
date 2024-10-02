import type {
  MetadataCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import { exists, like, not, notExists, or, sql } from "drizzle-orm";
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

import { targetCondition } from "@ctrlplane/validators/targets";

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

export const targetView = pgTable("target_view", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  filter: jsonb("filter").notNull().$type<TargetCondition>(),
});

export type TargetView = InferSelectModel<typeof targetView>;

export const createTargetView = createInsertSchema(targetView, {
  filter: targetCondition,
}).omit({ id: true });

export const updateTargetView = createTargetView.partial();

export const targetMetadata = pgTable(
  "target_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    targetId: uuid("target_id")
      .references(() => target.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.key, t.targetId) }),
);

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === "null")
    return notExists(
      tx
        .select()
        .from(targetMetadata)
        .where(
          and(
            eq(targetMetadata.targetId, target.id),
            eq(targetMetadata.key, cond.key),
          ),
        ),
    );

  if (cond.operator === "regex")
    return exists(
      tx
        .select()
        .from(targetMetadata)
        .where(
          and(
            eq(targetMetadata.targetId, target.id),
            eq(targetMetadata.key, cond.key),
            sql`${targetMetadata.value} ~ ${cond.value}`,
          ),
        ),
    );

  if (cond.operator === "like")
    return exists(
      tx
        .select()
        .from(targetMetadata)
        .where(
          and(
            eq(targetMetadata.targetId, target.id),
            eq(targetMetadata.key, cond.key),
            like(targetMetadata.value, cond.value),
          ),
        ),
    );

  if ("value" in cond)
    return exists(
      tx
        .select()
        .from(targetMetadata)
        .where(
          and(
            eq(targetMetadata.targetId, target.id),
            eq(targetMetadata.key, cond.key),
            eq(targetMetadata.value, cond.value),
          ),
        ),
    );

  throw Error("invalid metadata conditions");
};

const buildCondition = (tx: Tx, cond: TargetCondition): SQL => {
  if (cond.type === "metadata") return buildMetadataCondition(tx, cond);

  if (cond.type === "kind") return eq(target.kind, cond.value);

  if (cond.type === "name") return like(target.name, cond.value);

  if (cond.type === "provider") return eq(target.providerId, cond.value);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con = cond.operator === "and" ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export function targetMatchesMetadata(
  tx: Tx,
  metadata?: TargetCondition | null,
): SQL<unknown> | undefined {
  return metadata == null || Object.keys(metadata).length === 0
    ? undefined
    : buildCondition(tx, metadata);
}
