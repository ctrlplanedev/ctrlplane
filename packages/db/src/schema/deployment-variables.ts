import type { TargetCondition } from "@ctrlplane/validators/targets";
import type { InferSelectModel } from "drizzle-orm";
import type { AnyPgColumn, ColumnsWithTable } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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

import { targetCondition } from "@ctrlplane/validators/targets";

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
      .references(() => deployment.id),
    defaultValueId: uuid("default_value_id").default(sql`NULL`),
    schema: jsonb("schema").$type<Record<string, any>>(),
  },
  (t) => ({
    uniq: uniqueIndex().on(t.deploymentId, t.key),
    defaultValueIdFK: foreignKey(defaultValueIdFKConstraint).onDelete(
      "set null",
    ),
  }),
);

export type DeploymentVariable = InferSelectModel<typeof deploymentVariable>;
export const createDeploymentVariable = createInsertSchema(deploymentVariable, {
  schema: z.record(z.any()).optional(),
}).omit({ id: true });
export const updateDeploymentVariable = createDeploymentVariable.partial();

export const deploymentVariableValue = pgTable(
  "deployment_variable_value",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableId: uuid("variable_id").notNull(),
    value: jsonb("value").$type<any>().notNull(),
    targetFilter: jsonb("target_filter")
      .$type<TargetCondition | null>()
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
  { targetFilter: targetCondition },
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
      .references(() => deployment.id),
    variableSetId: uuid("variable_set_id")
      .notNull()
      .references(() => variableSet.id, { onDelete: "cascade" }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.deploymentId, t.variableSetId) }),
);
