import { jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";

export const deploymentVariable = pgTable("deployment_variable", {
  id: uuid("id").primaryKey().defaultRandom(),
  deploymentId: uuid("deployment_id")
    .notNull()
    .references(() => deployment.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  description: text("description"),
  defaultValue: jsonb("default_value"),
});
