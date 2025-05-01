import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { VariableConfigType } from "@ctrlplane/validators/variables";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn, ColumnsWithTable } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  foreignKey,
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
    valueType: text("value_type").notNull().default("direct"), // 'direct' | 'reference'

    resourceSelector: jsonb("resource_selector")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),

    // Direct value fields
    value: jsonb("value").$type<any>(),
    sensitive: boolean("sensitive").notNull().default(false),

    // Reference fields
    reference: text("reference"),
    path: text("path").array(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.variableId, t.value),
    variableIdFk: foreignKey({
      columns: [t.variableId],
      foreignColumns: [deploymentVariable.id],
    })
      .onUpdate("restrict")
      .onDelete("cascade"),

    // Add check constraint to ensure proper field combinations
    check: sql`CONSTRAINT valid_value_type CHECK (
      (value_type = 'direct' AND value IS NOT NULL AND reference IS NULL AND path IS NULL) OR
      (value_type = 'reference' AND value IS NULL AND reference IS NOT NULL AND path IS NOT NULL)
    )`,
  }),
);

export type DeploymentVariableValue = InferSelectModel<
  typeof deploymentVariableValue
>;
export const createDeploymentVariableValue = createInsertSchema(
  deploymentVariableValue,
  { resourceSelector: resourceCondition.refine(isValidResourceCondition) },
)
  .omit({
    id: true,
    variableId: true,
  })
  .extend({
    default: z.boolean().optional(),
    path: z.array(z.string()).nullable().optional(),
  });

export const updateDeploymentVariableValue =
  createDeploymentVariableValue.partial();

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
    values: z
      .array(createDeploymentVariableValue)
      .optional()
      .refine(
        (v) => {
          if (v == null) return true;
          const numDefault = v.filter((val) => val.default === true).length;
          return numDefault <= 1;
        },
        { message: "Only one default value is allowed" },
      ),
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
