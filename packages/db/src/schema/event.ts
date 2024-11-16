import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

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

export const createHook = createInsertSchema(hook)
  .omit({ id: true })
  .extend({ runbookIds: z.array(z.string().uuid()) });

export const updateHook = createHook.partial();
export type Hook = InferSelectModel<typeof hook>;
export const hookRelations = relations(hook, ({ many }) => ({
  runhooks: many(runhook),
}));

export const runhook = pgTable("runhook", {
  id: uuid("id").primaryKey().defaultRandom(),
  hookId: uuid("hook_id")
    .notNull()
    .references(() => hook.id, { onDelete: "cascade" }),
  runbookId: uuid("runbook_id")
    .notNull()
    .references(() => runbook.id, { onDelete: "cascade" }),
});

export const runhookRelations = relations(runhook, ({ one }) => ({
  hook: one(hook, { fields: [runhook.hookId], references: [hook.id] }),
  runbook: one(runbook, {
    fields: [runhook.runbookId],
    references: [runbook.id],
  }),
}));
