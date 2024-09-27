import type { TargetCondition } from "@ctrlplane/validators/targets";
import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
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
    targetFilter: jsonb("target_filter")
      .$type<TargetCondition | null>()
      .default(sql`NULL`),
  },
  (t) => ({ uniq: uniqueIndex().on(t.variableId, t.value) }),
);
export type DeploymentVariableValue = InferSelectModel<
  typeof deploymentVariableValue
>;
export const createDeploymentVariableValue = createInsertSchema(
  deploymentVariableValue,
  { targetFilter: targetCondition },
).omit({
  id: true,
});
export const updateDeploymentVariableValue =
  createDeploymentVariableValue.partial();

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
