import { relations, sql } from "drizzle-orm";
import {
  boolean,
  integer,
  json,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const rule = pgTable("rule", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),

  priority: integer("priority").notNull().default(0),

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

export const ruleTarget = pgTable("rule_target", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  deploymentSelector: json("deployment_selector"),
  environmentSelector: json("environment_selector"),
});

export const ruleRollout = pgTable("rule_rollout", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  timeWindowMinutes: integer("time_window_minutes").notNull().default(0),
  maxDeploymentsPerTimeWindow: integer("max_deployments_per_time_window")
    .notNull()
    .default(0),
});

export const ruleApproval = pgTable("rule_approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  approvalType: text("approval_type").notNull().default("anyone"), // 'anyone' or 'team'
  teamId: uuid("team_id").default(sql`NULL`), // For future team-specific approvals
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).$onUpdate(
    () => new Date(),
  ),
});

export const ruleMaintenanceWindow = pgTable("rule_maintenance_window", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  start: timestamp("start", { withTimezone: true }).notNull(),
  end: timestamp("end", { withTimezone: true }).notNull(),
});

export const ruleResourceConcurrency = pgTable("rule_resource_concurrency", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  // resourceSelector: json("resource_selector").default(sql`NULL`),
  concurrencyLimit: integer("concurrency_limit").notNull().default(0),
});

export const rulePreviousDeployStatus = pgTable("rule_previous_deploy_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  minSuccessfulDeployments: integer("min_successful_deployments")
    .notNull()
    .default(0),
  requireAllResources: boolean("require_all_resources")
    .notNull()
    .default(false),
  environmentSelector: json("environment_selector").notNull(),
});

export const ruleVersionMetadataValidation = pgTable(
  "rule_version_metadata_validation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rule.id, { onDelete: "cascade" }),
    metadataKey: text("metadata_key").notNull(),
    requiredValue: text("required_value").notNull(),
    allowMissingMetadata: boolean("allow_missing_metadata")
      .notNull()
      .default(false),
    customErrorMessage: text("custom_error_message"),
  },
);

export const ruleTimeWindowDays = pgEnum("rule_time_window_days", [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export const ruleTimeWindow = pgTable("rule_time_window", {
  id: uuid("id").primaryKey().defaultRandom(),
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => rule.id, { onDelete: "cascade" }),
  startHour: integer("start_hour").notNull(),
  endHour: integer("end_hour").notNull(),
  days: ruleTimeWindowDays("days").array().notNull(),
  timezone: text("timezone").notNull(),
});

export const ruleRelationships = relations(rule, ({ many, one }) => ({
  targets: many(ruleTarget),
  rollouts: many(ruleRollout),
  approvals: many(ruleApproval),
  maintenanceWindows: many(ruleMaintenanceWindow),
  resourceConcurrency: one(ruleResourceConcurrency),
  previousDeployStatus: many(rulePreviousDeployStatus),
  timeWindows: many(ruleTimeWindow),
  versionMetadataValidation: many(ruleVersionMetadataValidation),
}));

export type Rule = typeof rule.$inferSelect;
export type RuleTarget = typeof ruleTarget.$inferSelect;
export type RuleRollout = typeof ruleRollout.$inferSelect;
export type RuleApproval = typeof ruleApproval.$inferSelect;
export type RuleMaintenanceWindow = typeof ruleMaintenanceWindow.$inferSelect;
export type RuleResourceConcurrency =
  typeof ruleResourceConcurrency.$inferSelect;
export type RulePreviousDeployStatus =
  typeof rulePreviousDeployStatus.$inferSelect;
export type RuleVersionMetadataValidation =
  typeof ruleVersionMetadataValidation.$inferSelect;
export type RuleTimeWindow = typeof ruleTimeWindow.$inferSelect;
