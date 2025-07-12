import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { VariableConfigType } from "@ctrlplane/validators/variables";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn, ColumnsWithTable } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  isValidResourceCondition,
  resourceCondition,
} from "@ctrlplane/validators/resources";
import { VariableConfig } from "@ctrlplane/validators/variables";

import { deployment } from "./deployment.js";
import { variableSet } from "./variable-sets.js";

export const deploymentVariable = pgTable(
  "deployment_variable",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    key: text("key").notNull(),
    description: text("description").notNull().default(""),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    defaultValueId: uuid("default_value_id")
      .references((): any => deploymentVariableValue.id, {
        onDelete: "set null",
      })
      .default(sql`NULL`),
    config: jsonb("schema").$type<VariableConfigType>(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.deploymentId, t.key),
    defaultValueIdFK: foreignKey(defaultValueIdFKConstraint).onDelete(
      "set null",
    ),
  }),
);

export type DeploymentVariable = InferSelectModel<typeof deploymentVariable>;
export type InsertDeploymentVariable = InferInsertModel<
  typeof deploymentVariable
>;

export const deploymentVariableValue = pgTable(
  "deployment_variable_value",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableId: uuid("variable_id").notNull(),
    resourceSelector: jsonb("resource_selector")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
    priority: integer("priority").notNull().default(0),
  },
  (t) => [
    foreignKey({
      columns: [t.variableId],
      foreignColumns: [deploymentVariable.id],
    })
      .onUpdate("restrict")
      .onDelete("cascade"),
  ],
);

type BaseVariableValue = typeof deploymentVariableValue.$inferSelect;

// Direct values
export const deploymentVariableValueDirect = pgTable(
  "deployment_variable_value_direct",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableValueId: uuid("variable_value_id")
      .notNull()
      .unique()
      .references(() => deploymentVariableValue.id, { onDelete: "cascade" }),
    value: jsonb("value").$type<string | number | boolean | object>(),
    valueHash: text("value_hash"),
    sensitive: boolean("sensitive").notNull().default(false),
  },
);

export const createDirectDeploymentVariableValue = z.object({
  resourceSelector: resourceCondition
    .optional()
    .nullable()
    .refine((val) => {
      if (val == null) return true;
      return isValidResourceCondition(val);
    }),
  isDefault: z.boolean().optional().default(false),
  priority: z.number().optional().default(0),

  value: z.union([z.string(), z.number(), z.boolean(), z.object({}), z.null()]),
  sensitive: z.boolean().optional().default(false),
});

export type CreateDirectDeploymentVariableValue = z.infer<
  typeof createDirectDeploymentVariableValue
>;

export const updateDirectDeploymentVariableValue =
  createDirectDeploymentVariableValue.partial();

type DirectVariableValue = Pick<
  typeof deploymentVariableValueDirect.$inferSelect,
  "value" | "valueHash" | "sensitive"
>;
export type DirectDeploymentVariableValue = BaseVariableValue &
  DirectVariableValue;

// Reference values
export const deploymentVariableValueReference = pgTable(
  "deployment_variable_value_reference",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableValueId: uuid("variable_value_id")
      .notNull()
      .unique()
      .references(() => deploymentVariableValue.id, { onDelete: "cascade" }),
    reference: text("reference").notNull(),
    path: text("path").array().notNull(),
    defaultValue: jsonb("default_value").$type<
      string | number | boolean | object
    >(),
  },
);

export const createReferenceDeploymentVariableValue = z.object({
  resourceSelector: resourceCondition
    .optional()
    .nullable()
    .refine((val) => {
      if (val == null) return true;
      return isValidResourceCondition(val);
    }),
  isDefault: z.boolean().optional().default(false),
  priority: z.number().optional().default(0),

  reference: z.string(),
  path: z.array(z.string()),
  defaultValue: z
    .union([z.string(), z.number(), z.boolean(), z.object({}), z.null()])
    .optional(),
});

export const updateReferenceDeploymentVariableValue =
  createReferenceDeploymentVariableValue.partial();

export type CreateReferenceDeploymentVariableValue = z.infer<
  typeof createReferenceDeploymentVariableValue
>;

type ReferenceVariableValue = Pick<
  typeof deploymentVariableValueReference.$inferSelect,
  "reference" | "path" | "defaultValue"
>;
export type ReferenceDeploymentVariableValue = BaseVariableValue &
  ReferenceVariableValue;

export type DeploymentVariableValue =
  | DirectDeploymentVariableValue
  | ReferenceDeploymentVariableValue;

export const isDeploymentVariableValueDirect = (
  value: DeploymentVariableValue,
) => "value" in value;

export const isDeploymentVariableValueReference = (
  value: DeploymentVariableValue,
) => "reference" in value;

// workaround for cirular reference - https://www.answeroverflow.com/m/1194395880523042936
const defaultValueIdFKConstraint: {
  columns: [AnyPgColumn<{ tableName: "deployment_variable" }>];
  foreignColumns: ColumnsWithTable<
    "deployment_variable",
    "deployment_variable_value",
    [AnyPgColumn<{ tableName: "deployment_variable" }>]
  >;
} = {
  columns: [deploymentVariable.defaultValueId],
  foreignColumns: [deploymentVariableValue.id],
};

export const deploymentVariableSet = pgTable(
  "deployment_variable_set",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    variableSetId: uuid("variable_set_id")
      .notNull()
      .references(() => variableSet.id, { onDelete: "cascade" }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.deploymentId, t.variableSetId) }),
);

export const createDeploymentVariable = createInsertSchema(deploymentVariable, {
  key: z.string().min(1),
  config: VariableConfig,
})
  .omit({ id: true, defaultValueId: true, deploymentId: true })
  .extend({
    directValues: z.array(createDirectDeploymentVariableValue).optional(),
    referenceValues: z.array(createReferenceDeploymentVariableValue).optional(),
  });

export const updateDeploymentVariable = createDeploymentVariable.partial();

export const deploymentVariableRelationships = relations(
  deploymentVariable,
  ({ one, many }) => ({
    deployment: one(deployment, {
      fields: [deploymentVariable.deploymentId],
      references: [deployment.id],
    }),

    defaultValue: one(deploymentVariableValue, {
      fields: [deploymentVariable.defaultValueId],
      references: [deploymentVariableValue.id],
    }),

    values: many(deploymentVariableValue),
  }),
);

export const deploymentVariableValueRelationships = relations(
  deploymentVariableValue,
  ({ one }) => ({
    variable: one(deploymentVariable, {
      fields: [deploymentVariableValue.variableId],
      references: [deploymentVariable.id],
    }),
  }),
);

export const deploymentVariableSetRelationships = relations(
  deploymentVariableSet,
  ({ one }) => ({
    deployment: one(deployment, {
      fields: [deploymentVariableSet.deploymentId],
      references: [deployment.id],
    }),
    variableSet: one(variableSet, {
      fields: [deploymentVariableSet.variableSetId],
      references: [variableSet.id],
    }),
  }),
);
