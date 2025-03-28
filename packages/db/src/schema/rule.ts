import type { Options } from "rrule";
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const policy = pgTable("policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),

  priority: integer("priority").notNull().default(0),

  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  enabled: boolean("enabled").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const policyTarget = pgTable("policy_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),
  deploymentSelector: jsonb("deployment_selector").default(sql`NULL`),
  environmentSelector: jsonb("environment_selector").default(sql`NULL`),
});

export const policyRuleDenyWindow = pgTable("policy_rule_deny_window", {
  id: uuid("id").primaryKey().defaultRandom(),

  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),

  name: text("name").notNull(),
  description: text("description"),

  // RRule fields stored as JSONB to match Options interface
  rrule: jsonb("rrule").notNull().default("{}").$type<Options>(),
  timeZone: text("time_zone").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
