import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { deployment } from "./deployment";
import { target } from "./target";

export const deploymentVariable = pgTable(
  "deployment_variable",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    key: text("key").notNull(),
    description: text("description").notNull().default(""),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id),

    // defaultValue: jsonb("default_value").$type<any>(),
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

export const variableDeploymentValueTargetFilter = pgTable(
  "deployment_variable_value_target_filter",
  {
    id: uuid("id").notNull().primaryKey().defaultRandom(),
    variableValueId: uuid("variable_value_id")
      .notNull()
      .references(() => deploymentVariableValue.id, { onDelete: "cascade" }),
    labels: jsonb("labels").notNull().$type<Record<string, string>>(),
  },
);
export type DeploymentVariableValueTargetFilter = InferInsertModel<
  typeof variableDeploymentValueTargetFilter
>;
export const createDeploymentVariableValueTargetFilter = createInsertSchema(
  variableDeploymentValueTargetFilter,
).omit({ id: true });
export const updateDeploymentVariableValueTargetFilter =
  createDeploymentVariableValueTargetFilter.partial();

export const variableDeploymentValueTarget = pgTable(
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
  typeof variableDeploymentValueTarget
>;
export const createDeploymentVariableValueTarget = createInsertSchema(
  variableDeploymentValueTarget,
).omit({ id: true });
export const updateDeploymentVariableValueTarget =
  createDeploymentVariableValueTarget.partial();
