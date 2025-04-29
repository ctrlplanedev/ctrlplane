import type {
  CreatedAtCondition,
  MetadataCondition,
} from "@ctrlplane/validators/conditions";
import type {
  IdentifierCondition,
  LastSyncCondition,
  NameCondition,
  ResourceCondition,
} from "@ctrlplane/validators/resources";
import type { InferInsertModel, InferSelectModel, SQL } from "drizzle-orm";
import {
  exists,
  gt,
  gte,
  ilike,
  lt,
  lte,
  not,
  notExists,
  or,
  relations,
  sql,
} from "drizzle-orm";
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
  ConditionType,
  DateOperator,
  MetadataOperator,
} from "@ctrlplane/validators/conditions";
import {
  resourceCondition,
  ResourceConditionType,
} from "@ctrlplane/validators/resources";

import type { Tx } from "../common.js";
import { job } from "./job.js";
import { releaseJobTrigger } from "./release-job-trigger.js";
import { releaseTarget } from "./release.js";
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
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
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
  releaseTrigger: many(releaseJobTrigger),
  jobRelationships: many(jobResourceRelationship),
  releaseTargets: many(releaseTarget),
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
export type ResourceToUpsert = InsertResource & {
  metadata?: Record<string, string>;
  variables?: Array<
    | { key: string; value: any; sensitive: boolean }
    | { key: string; defaultValue?: any; reference: string; path: string[] }
  >;
};

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
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.StartsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            ilike(resourceMetadata.value, `${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.EndsWith)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            ilike(resourceMetadata.value, `%${cond.value}`),
          ),
        )
        .limit(1),
    );

  if (cond.operator === MetadataOperator.Contains)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            ilike(resourceMetadata.value, `%${cond.value}%`),
          ),
        )
        .limit(1),
    );

  if ("value" in cond)
    return exists(
      tx
        .select({ value: sql<number>`1` })
        .from(resourceMetadata)
        .where(
          and(
            eq(resourceMetadata.resourceId, resource.id),
            eq(resourceMetadata.key, cond.key),
            eq(resourceMetadata.value, cond.value),
          ),
        )
        .limit(1),
    );

  throw Error("invalid metadata conditions");
};

const buildIdentifierCondition = (tx: Tx, cond: IdentifierCondition): SQL => {
  if (cond.operator === ColumnOperator.Equals)
    return eq(resource.identifier, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return ilike(resource.identifier, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return ilike(resource.identifier, `%${cond.value}`);
  return ilike(resource.identifier, `%${cond.value}%`);
};

const buildNameCondition = (tx: Tx, cond: NameCondition): SQL => {
  if (cond.operator === ColumnOperator.Equals)
    return eq(resource.name, cond.value);
  if (cond.operator === ColumnOperator.StartsWith)
    return ilike(resource.name, `${cond.value}%`);
  if (cond.operator === ColumnOperator.EndsWith)
    return ilike(resource.name, `%${cond.value}`);
  return ilike(resource.name, `%${cond.value}%`);
};

const buildCreatedAtCondition = (tx: Tx, cond: CreatedAtCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before)
    return lt(resource.createdAt, date);
  if (cond.operator === DateOperator.After) return gt(resource.createdAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(resource.createdAt, date);
  return gte(resource.createdAt, date);
};

const buildLastSyncCondition = (tx: Tx, cond: LastSyncCondition): SQL => {
  const date = new Date(cond.value);
  if (cond.operator === DateOperator.Before)
    return lt(resource.updatedAt, date);
  if (cond.operator === DateOperator.After) return gt(resource.updatedAt, date);
  if (cond.operator === DateOperator.BeforeOrOn)
    return lte(resource.updatedAt, date);
  return gte(resource.updatedAt, date);
};

const buildCondition = (tx: Tx, cond: ResourceCondition): SQL => {
  if (cond.type === ResourceConditionType.Metadata)
    return buildMetadataCondition(tx, cond);
  if (cond.type === ResourceConditionType.Kind)
    return eq(resource.kind, cond.value);
  if (cond.type === ResourceConditionType.Name)
    return buildNameCondition(tx, cond);
  if (cond.type === ResourceConditionType.Provider)
    return eq(resource.providerId, cond.value);
  if (cond.type === ResourceConditionType.Identifier)
    return buildIdentifierCondition(tx, cond);
  if (cond.type === ConditionType.CreatedAt)
    return buildCreatedAtCondition(tx, cond);
  if (cond.type === ResourceConditionType.LastSync)
    return buildLastSyncCondition(tx, cond);
  if (cond.type === ResourceConditionType.Version)
    return eq(resource.version, cond.value);
  if (cond.type === ResourceConditionType.Id)
    return eq(resource.id, cond.value);

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
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    fromIdentifier: text("from_identifier").notNull(),
    toIdentifier: text("to_identifier").notNull(),
    type: resourceRelationshipType("type").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.toIdentifier, t.fromIdentifier) }),
);

export const createResourceRelationship = createInsertSchema(
  resourceRelationship,
).omit({ id: true });

export const updateResourceRelationship = createResourceRelationship.partial();
export type ResourceRelationship = InferSelectModel<
  typeof resourceRelationship
>;

export const jobResourceRelationship = pgTable(
  "job_resource_relationship",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .references(() => job.id, { onDelete: "cascade" })
      .notNull(),
    resourceIdentifier: text("resource_identifier").notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.jobId, t.resourceIdentifier) }),
);

export const jobResourceRelationshipRelations = relations(
  jobResourceRelationship,
  ({ one }) => ({
    job: one(job, {
      fields: [jobResourceRelationship.jobId],
      references: [job.id],
    }),
    resource: one(resource, {
      fields: [jobResourceRelationship.resourceIdentifier],
      references: [resource.identifier],
    }),
  }),
);

export const resourceVariable = pgTable(
  "resource_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resourceId: uuid("resource_id")
      .references(() => resource.id, { onDelete: "cascade" })
      .notNull(),
    key: text("key").notNull(),

    // Direct value fields
    value: jsonb("value").$type<string | number | boolean | object>(),
    sensitive: boolean("sensitive").notNull().default(false),

    // Reference fields
    reference: text("reference"),
    path: text("path").array(),
    defaultValue: jsonb("default_value").$type<
      string | number | boolean | object
    >(),

    // Ensure either value OR (reference AND path) are set
    valueType: text("value_type").notNull().default("direct"), // 'direct' | 'reference'
  },
  (t) => [
    uniqueIndex().on(t.resourceId, t.key),
    // Add a check constraint to ensure proper field combinations
    sql`CONSTRAINT valid_value_type CHECK (
      (value_type = 'direct' AND value IS NOT NULL AND reference IS NULL AND path IS NULL) OR
      (value_type = 'reference' AND value IS NULL AND reference IS NOT NULL AND path IS NOT NULL)
    )`,
  ],
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
  value: z
    .union([z.string(), z.number(), z.boolean(), z.record(z.any())])
    .optional(),
  reference: z.string().optional(),
  path: z.array(z.string()).optional(),
  defaultValue: z
    .union([z.string(), z.number(), z.boolean(), z.record(z.any())])
    .optional(),
  valueType: z.enum(["direct", "reference"]),
})
  .omit({ id: true })
  .refine(
    (data) => {
      if (data.valueType === "direct") {
        return (
          data.value != null && data.reference == null && data.path == null
        );
      } else {
        return (
          data.value == null && data.reference != null && data.path != null
        );
      }
    },
    { message: "Invalid combination of fields for the specified value type" },
  );

// For updates, we'll create a new schema that makes all fields optional
export const updateResourceVariable = z
  .object({
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    reference: z.string().optional(),
    path: z.array(z.string()).optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
    valueType: z.enum(["direct", "reference"]).optional(),
    sensitive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.valueType === "direct") {
        return (
          data.value != null && data.reference == null && data.path == null
        );
      } else if (data.valueType === "reference") {
        return (
          data.value == null && data.reference != null && data.path != null
        );
      }
      return true; // If valueType not provided, no validation needed
    },
    { message: "Invalid combination of fields for the specified value type" },
  );

const baseVariableSchema = createInsertSchema(resourceVariable);

export const directVariableSchema = baseVariableSchema.extend({
  id: z.string().uuid(),
  valueType: z.literal("direct"),
  value: z.union([z.string(), z.number(), z.boolean()]),
  reference: z.null().or(z.undefined()),
  path: z.null().or(z.undefined()),
  defaultValue: z.any().optional(),
});

export const referenceVariableSchema = baseVariableSchema.extend({
  id: z.string().uuid(),
  valueType: z.literal("reference"),
  value: z.null().or(z.undefined()),
  reference: z.string(),
  path: z.array(z.string()),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const resourceVariableSchema = z.discriminatedUnion("valueType", [
  directVariableSchema,
  referenceVariableSchema,
]);

export type DirectResourceVariable = z.infer<typeof directVariableSchema>;
export type ReferenceResourceVariable = z.infer<typeof referenceVariableSchema>;
export type ResourceVariable =
  | DirectResourceVariable
  | ReferenceResourceVariable;
