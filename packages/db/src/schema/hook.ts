import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { runbook } from "./runbook.js";

export const runhook = pgTable("runhook", {
  id: uuid("id").primaryKey().defaultRandom(),
  scopeType: text("scope_type").notNull(),
  scopeId: uuid("scope_id").notNull(),
  runbookId: uuid("runbook_id")
    .references(() => runbook.id, { onDelete: "cascade" })
    .notNull(),
});

export const runhookEvent = pgTable("runhook_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  runhookId: uuid("runhook_id")
    .references(() => runhook.id, { onDelete: "cascade" })
    .notNull(),
  eventType: text("event_type").notNull(),
});
