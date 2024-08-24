import { boolean, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { runbook } from "./runbook.js";

export const runbookVariable = pgTable("runbook_variable", {
  id: uuid("id").notNull().primaryKey().defaultRandom(),
  key: text("key").notNull(),
  description: text("description").notNull().default(""),
  runbookId: uuid("runbook_id")
    .notNull()
    .references(() => runbook.id),
  required: boolean("required").notNull(),
  defaultValue: jsonb("default_value").$type<any>(),
  schema: jsonb("schema").$type<Record<string, any>>(),
});
