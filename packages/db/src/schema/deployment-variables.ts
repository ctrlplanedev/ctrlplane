import type { LabelCondition } from "@ctrlplane/validators/targets";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { deployment } from "./deployment.js";
import { target } from "./target.js";
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
    schema: jsonb("schema").$type<Record<string, any>>(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.deploymentId, t.key) }),
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
    variableId: uuid("variable_id")
      .notNull()
      .references(() => deploymentVariable.id, { onDelete: "cascade" }),
    value: jsonb("value").$type<any>().notNull(),
  },
  (t) => ({ uniq: uniqueIndex().on(t.variableId, t.value) }),
);
export type DeploymentVariableValue = InferInsertModel<
  typeof deploymentVariableValue
>;
export const createDeploymentVariableValue = createInsertSchema(
  deploymentVariableValue,
).omit({
  id: true,
});
export const updateDeploymentVariableValue =
  createDeploymentVariableValue.partial();

export const deploymentVariableValueTargetFilter = pgTable(
  "deployment_variable_value_target_filter",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableValueId: uuid("variable_value_id")
      .notNull()
      .references(() => deploymentVariableValue.id, { onDelete: "cascade" }),
    targetFilter: jsonb("target_filter").$type<LabelCondition>().notNull(),
  },
);
export type DeploymentVariableValueTargetFilter = InferInsertModel<
  typeof deploymentVariableValueTargetFilter
>;
export const createDeploymentVariableValueTargetFilter = createInsertSchema(
  deploymentVariableValueTargetFilter,
).omit({ id: true });
export const updateDeploymentVariableValueTargetFilter =
  createDeploymentVariableValueTargetFilter.partial();

export const deploymentVariableValueTarget = pgTable(
  "deployment_variable_value_target",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableValueId: uuid("variable_value_id")
      .notNull()
      .references(() => deploymentVariableValue.id, { onDelete: "cascade" }),
    targetId: uuid("target_id")
      .notNull()
      .references(() => target.id, { onDelete: "cascade" }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.variableValueId, t.targetId) }),
);
export type DeploymentVariableValueTarget = InferInsertModel<
  typeof deploymentVariableValueTarget
>;
export const createDeploymentVariableValueTarget = createInsertSchema(
  deploymentVariableValueTarget,
).omit({ id: true });
export const updateDeploymentVariableValueTarget =
  createDeploymentVariableValueTarget.partial();

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
