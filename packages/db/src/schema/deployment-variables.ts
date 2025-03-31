import type { ResourceCondition } from "@ctrlplane/validators/resources";
import type { VariableConfigType } from "@ctrlplane/validators/variables";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn, ColumnsWithTable } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { resourceCondition } from "@ctrlplane/validators/resources";
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
export const createDeploymentVariable = createInsertSchema(deploymentVariable, {
  key: z.string().min(1),
  config: VariableConfig,
}).omit({ id: true });
export const updateDeploymentVariable = createDeploymentVariable.partial();

export const deploymentVariableValue = pgTable(
  "deployment_variable_value",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableId: uuid("variable_id").notNull(),
    value: jsonb("value").$type<any>().notNull(),
    resourceSelector: jsonb("resource_selector")
      .$type<ResourceCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.variableId, t.value),
    variableIdFk: foreignKey({
      columns: [t.variableId],
      foreignColumns: [deploymentVariable.id],
    })
      .onUpdate("restrict")
      .onDelete("cascade"),
  }),
);
export type DeploymentVariableValue = InferSelectModel<
  typeof deploymentVariableValue
>;
export const createDeploymentVariableValue = createInsertSchema(
  deploymentVariableValue,
  { resourceSelector: resourceCondition },
)
  .omit({
    id: true,
  })
  .extend({
    default: z.boolean().optional(),
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
