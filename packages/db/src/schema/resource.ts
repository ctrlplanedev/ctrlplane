import type { MetadataCondition } from "@ctrlplane/validators/conditions";
import type {
  IdentifierCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
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
  resourceCondition,
  ResourceFilterType,
} from "@ctrlplane/validators/resources";

import type { Tx } from "../common.js";
import { resourceProvider } from "./resource-provider.js";
import { workspace } from "./workspace.js";

export const resource = pgTable(
  "resource",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: text("version").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    identifier: text("identifier").notNull(),
    providerId: uuid("provider_id").references(() => resourceProvider.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    config: jsonb("config")
      .notNull()
      .default("{}")
      .$type<Record<string, any>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
      () => new Date(),
    ),
  },
  (t) => ({ uniq: uniqueIndex().on(t.identifier, t.workspaceId) }),
);

export const resourceRelations = relations(resource, ({ one, many }) => ({
  metadata: many(resourceMetadata),
  variables: many(resourceVariable),
  provider: one(resourceProvider, {
    fields: [resource.providerId],
    references: [resourceProvider.id],
  }),
  workspace: one(workspace, {
    fields: [resource.workspaceId],
    references: [workspace.id],
  }),
}));

export type Resource = InferSelectModel<typeof resource>;

export const createResource = createInsertSchema(resource, {
  version: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  providerId: z.string().uuid().optional(),
  config: z.record(z.any()),
}).omit({ id: true });

export type InsertResource = InferInsertModel<typeof resource>;

export const updateResource = createResource.partial();

export const resourceSchema = pgTable(
  "resource_schema",
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

export const resourceView = pgTable("resource_view", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").default(""),
  filter: jsonb("filter").notNull().$type<ResourceCondition>(),
});

export type ResourceView = InferSelectModel<typeof resourceView>;

export const createResourceView = createInsertSchema(resourceView, {
  filter: resourceCondition,
}).omit({ id: true });

export const updateResourceView = createResourceView.partial();

export const resourceMetadata = pgTable(
  "resource_metadata",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.key, t.resourceId) }),
);

export const resourceMetadataRelations = relations(
  resourceMetadata,
  ({ one }) => ({
    resource: one(resource, {
      fields: [resourceMetadata.resourceId],
      references: [resource.id],
    }),
  }),
);

const buildMetadataCondition = (tx: Tx, cond: MetadataCondition): SQL => {
  if (cond.operator === MetadataOperator.Null)
    return notExists(
      tx
        .select()
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
          ),
        ),
    );

  if (cond.operator === MetadataOperator.Regex)
    return exists(
      tx
        .select()
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            sql`${resourceMetadata.value} ~ ${cond.value}`,
          ),
        ),
    );

  if (cond.operator === MetadataOperator.Like)
    return exists(
      tx
        .select()
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            like(resourceMetadata.value, cond.value),
          ),
        ),
    );

  if ("value" in cond)
    return exists(
      tx
        .select()
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            eq(resourceMetadata.value, cond.value),
          ),
        ),
    );

  throw Error("invalid metadata conditions");
};

const buildIdentifierCondition = (tx: Tx, cond: IdentifierCondition): SQL => {
  if (cond.operator === ColumnOperator.Like)
    return like(resource.identifier, cond.value);
  if (cond.operator === ColumnOperator.Equals)
    return eq(resource.identifier, cond.value);
  return sql`${resource.identifier} ~ ${cond.value}`;
};

const buildCondition = (tx: Tx, cond: ResourceCondition): SQL => {
  if (cond.type === ResourceFilterType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === ResourceFilterType.Kind)
    return eq(resource.kind, cond.value);
  if (cond.type === ResourceFilterType.Name)
    return like(resource.name, cond.value);
  if (cond.type === ResourceFilterType.Provider)
    return eq(resource.providerId, cond.value);
  if (cond.type === ResourceFilterType.Identifier)
    return buildIdentifierCondition(tx, cond);

  if (cond.conditions.length === 0) return sql`FALSE`;

  const subCon = cond.conditions.map((c) => buildCondition(tx, c));
  const con =
    cond.operator === ComparisonOperator.And ? and(...subCon)! : or(...subCon)!;
  return cond.not ? not(con) : con;
};

export function resourceMatchesMetadata(
  tx: Tx,
  metadata?: ResourceCondition | null,
): SQL<unknown> | undefined {
  return metadata == null || Object.keys(metadata).length === 0
    ? undefined
    : buildCondition(tx, metadata);
}

export const resourceRelationshipType = pgEnum("resource_relationship_type", [
  "associated_with",
  "depends_on",
]);

export const resourceRelationship = pgTable(
  "resource_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
    targetId: uuid("target_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
    type: resourceRelationshipType("type").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.targetId, t.sourceId) }),
);

export const createResourceRelationship = createInsertSchema(
  resourceRelationship,
).omit({ id: true });

export const updateResourceRelationship = createResourceRelationship.partial();
export type ResourceRelationship = InferSelectModel<
  typeof resourceRelationship
>;

export const resourceVariable = pgTable(
  "resource_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),

    key: text("key").notNull(),
    value: jsonb("value").$type<string | number | boolean>().notNull(),
    sensitive: boolean("sensitive").notNull().default(false),
  },
  (t) => ({ uniq: uniqueIndex().on(t.resourceId, t.key) }),
);

export const resourceVariableRelations = relations(
  resourceVariable,
  ({ one }) => ({
    resource: one(resource, {
      fields: [resourceVariable.resourceId],
      references: [resource.id],
    }),
  }),
);

export const createResourceVariable = createInsertSchema(resourceVariable, {
  value: z.union([z.string(), z.number(), z.boolean()]),
}).omit({ id: true });

export const updateResourceVariable = createResourceVariable.partial();
export type ResourceVariable = InferSelectModel<typeof resourceVariable>;
