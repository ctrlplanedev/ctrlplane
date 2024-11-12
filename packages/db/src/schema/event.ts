import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { runbook } from "./runbook.js";

export const event = pgTable("event", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  payload: jsonb("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const hook = pgTable("hook", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: text("action").notNull(),
  name: text("name").notNull(),
  scopeType: text("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
});

export const runhook = pgTable("runhook", {
  id: uuid("id").primaryKey().defaultRandom(),
  hookId: uuid("hook_id")
    .notNull()
    .references(() => hook.id, { onDelete: "cascade" }),
  runbookId: uuid("runbook_id")
    .notNull()
    .references(() => runbook.id, { onDelete: "cascade" }),
});
