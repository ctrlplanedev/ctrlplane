import {
  bigint,
  jsonb,
  pgTable,
  text,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";

export const deploymentVariable = pgTable(
  "deployment_variable",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deploymentId: uuid("deployment_id")
      .notNull()
      .references(() => deployment.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    description: text("description"),
    defaultValue: jsonb("default_value"),
  },
  (t) => [unique().on(t.deploymentId, t.key)],
);

export const deploymentVariableValue = pgTable("deployment_variable_value", {
  id: uuid("id").primaryKey().defaultRandom(),
  deploymentVariableId: uuid("deployment_variable_id")
    .notNull()
    .references(() => deploymentVariable.id, { onDelete: "cascade" }),
  value: jsonb("value").notNull(),
  resourceSelector: text("resource_selector"),
  priority: bigint("priority", { mode: "number" }).notNull().default(0),
});
