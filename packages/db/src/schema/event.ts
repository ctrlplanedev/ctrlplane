import type { InferSelectModel } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { createRunbookVariable } from "./runbook-variables.js";
import { runbook } from "./runbook.js";
import { workspace } from "./workspace.js";

export const event = pgTable("event", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
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
  .extend({
    jobAgentId: z.string().optional(),
    jobAgentConfig: z.record(z.any()).optional(),
    variables: z.array(createRunbookVariable),
  });

export const updateHook = createHook.partial();
export type Hook = InferSelectModel<typeof hook>;
export const hookRelations = relations(hook, ({ many }) => ({
  runhooks: many(runhook),
}));

export const runhook = pgTable(
  "runhook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    hookId: uuid("hook_id")
      .notNull()
      .references(() => hook.id, { onDelete: "cascade" }),
    runbookId: uuid("runbook_id")
      .notNull()
      .references(() => runbook.id, { onDelete: "cascade" }),
  },
  (t) => ({ uniq: uniqueIndex().on(t.hookId, t.runbookId) }),
);

export const runhookRelations = relations(runhook, ({ one }) => ({
  hook: one(hook, { fields: [runhook.hookId], references: [hook.id] }),
  runbook: one(runbook, {
    fields: [runhook.runbookId],
    references: [runbook.id],
  }),
}));
