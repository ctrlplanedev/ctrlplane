import type { MetadataCondition } from "@ctrlplane/validators/conditions";
import type {
  IdentifierCondition,
  TargetCondition,
} from "@ctrlplane/validators/targets";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import { exists, like, not, notExists, or, relations, sql } from "drizzle-orm";
import {
  boolean,
  json,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { and, eq } from "drizzle-orm/sql";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  ColumnOperator,
  ComparisonOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import {
  targetCondition,
  TargetFilterType,
} from "@ctrlplane/validators/targets";

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

export const targetRelations = relations(target, ({ one, many }) => ({
  metadata: many(targetMetadata),
  variables: many(targetVariable),
  provider: one(targetProvider, {
    fields: [target.providerId],
    references: [targetProvider.id],
  }),
}));

export type Target = InferSelectModel<typeof target>;

export const createTarget = createInsertSchema(target, {
  version: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  providerId: z.string().uuid().optional(),
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

export const targetMetadataRelations = relations(targetMetadata, ({ one }) => ({
  target: one(target, {
    fields: [targetMetadata.targetId],
    references: [target.id],
  }),
}));

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
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

  if (cond.operator === MetadataOperator.Regex)
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

  if (cond.operator === MetadataOperator.Like)
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

const buildIdentifierCondition = (tx: Tx, cond: IdentifierCondition): SQL => {
  if (cond.operator === ColumnOperator.Like)
    return like(target.identifier, cond.value);
  if (cond.operator === ColumnOperator.Equals)
    return eq(target.identifier, cond.value);
  return sql`${target.identifier} ~ ${cond.value}`;
};

const buildCondition = (tx: Tx, cond: TargetCondition): SQL => {
  if (cond.type === TargetFilterType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === TargetFilterType.Kind) return eq(target.kind, cond.value);
  if (cond.type === TargetFilterType.Name) return like(target.name, cond.value);
  if (cond.type === TargetFilterType.Provider)
    return eq(target.providerId, cond.value);
  if (cond.type === TargetFilterType.Identifier)
    return buildIdentifierCondition(tx, cond);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
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

export const targetRelationshipType = pgEnum("target_relationship_type", [
  "associated_with",
  "depends_on",
]);

export const targetRelationship = pgTable(
  "target_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .references(() => target.id, { onDelete: "cascade" })
      .notNull(),
    targetId: uuid("target_id")
      .references(() => target.id, { onDelete: "cascade" })
      .notNull(),
    type: targetRelationshipType("type").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.targetId, t.sourceId) }),
);

export const createTargetRelationship = createInsertSchema(
  targetRelationship,
).omit({ id: true });

export const updateTargetRelationship = createTargetRelationship.partial();
export type TargetRelationship = InferSelectModel<typeof targetRelationship>;

export const targetVariable = pgTable(
  "target_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetId: uuid("target_id")
      .references(() => target.id, { onDelete: "cascade" })
      .notNull(),

    key: text("key").notNull(),
    value: jsonb("value").$type<string | number | boolean>().notNull(),
    sensitive: boolean("sensitive").notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex().on(t.targetId, t.key) }),
);

export const targetVariableRelations = relations(targetVariable, ({ one }) => ({
  target: one(target, {
    fields: [targetVariable.targetId],
    references: [target.id],
  }),
}));

export const createTargetVariable = createInsertSchema(targetVariable, {
  value: z.union([z.string(), z.number(), z.boolean()]),
}).omit({ id: true });

export const updateTargetVariable = createTargetVariable.partial();
export type TargetVariable = InferSelectModel<typeof targetVariable>;
