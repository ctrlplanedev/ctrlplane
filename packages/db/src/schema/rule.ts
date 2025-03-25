import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { environment } from "./environment.js";
import { workspace } from "./workspace.js";

export const rule = pgTable("rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),

  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const ruleRollout = pgTable("rule_rollout", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  timeWindowMinutes: integer("time_window_minutes").notNull().default(0),
  deploymentsPerTimeWindow: integer("deployments_per_time_window")
    .notNull()
    .default(0),
});

export const ruleApproval = pgTable("rule_approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  environmentId: uuid("environment_id")
    .notNull()
    .references(() => environment.id, { onDelete: "cascade" }),
});

export const ruleMatianceWindow = pgTable("rule_matiance_window", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
});
