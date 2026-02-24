import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { workspace } from "./workspace.js";

export const policy = pgTable("policy", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  selector: text("selector").notNull().default("true"),

  metadata: jsonb("metadata")
    .notNull()
    .default("{}")
    .$type<Record<string, string>>(),

  priority: integer("priority").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),

  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const policyRelations = relations(policy, ({ many }) => ({
  anyApprovalRules: many(policyRuleAnyApproval),
  deploymentDependencyRules: many(policyRuleDeploymentDependency),
  deploymentWindowRules: many(policyRuleDeploymentWindow),
  environmentProgressionRules: many(policyRuleEnvironmentProgression),
  gradualRolloutRules: many(policyRuleGradualRollout),
  retryRules: many(policyRuleRetry),
  rollbackRules: many(policyRuleRollback),
  verificationRules: many(policyRuleVerification),
  versionCooldownRules: many(policyRuleVersionCooldown),
  versionSelectorRules: many(policyRuleVersionSelector),
}));

export const policyRuleAnyApproval = pgTable("policy_rule_any_approval", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),
  minApprovals: integer("min_approvals").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const policyRuleAnyApprovalRelations = relations(
  policyRuleAnyApproval,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleAnyApproval.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleDeploymentDependency = pgTable(
  "policy_rule_deployment_dependency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),
    dependsOn: text("depends_on").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const policyRuleDeploymentDependencyRelations = relations(
  policyRuleDeploymentDependency,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDeploymentDependency.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleDeploymentWindow = pgTable(
  "policy_rule_deployment_window",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),
    allowWindow: boolean("allow_window"),
    durationMinutes: integer("duration_minutes").notNull(),
    rrule: text("rrule").notNull(),
    timezone: text("timezone"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const policyRuleDeploymentWindowRelations = relations(
  policyRuleDeploymentWindow,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDeploymentWindow.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleEnvironmentProgression = pgTable(
  "policy_rule_environment_progression",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),
    dependsOnEnvironmentSelector: text(
      "depends_on_environment_selector",
    ).notNull(),
    maximumAgeHours: integer("maximum_age_hours"),
    minimumSoakTimeMinutes: integer("minimum_soak_time_minutes"),
    minimumSuccessPercentage: real("minimum_success_percentage"),
    successStatuses: text("success_statuses").array(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const policyRuleEnvironmentProgressionRelations = relations(
  policyRuleEnvironmentProgression,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleEnvironmentProgression.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleGradualRollout = pgTable(
  "policy_rule_gradual_rollout",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),
    rolloutType: text("rollout_type").notNull(),
    timeScaleInterval: integer("time_scale_interval").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const policyRuleGradualRolloutRelations = relations(
  policyRuleGradualRollout,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleGradualRollout.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleRetry = pgTable("policy_rule_retry", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),
  maxRetries: integer("max_retries").notNull(),
  backoffSeconds: integer("backoff_seconds"),
  backoffStrategy: text("backoff_strategy"),
  maxBackoffSeconds: integer("max_backoff_seconds"),
  retryOnStatuses: text("retry_on_statuses").array(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const policyRuleRetryRelations = relations(
  policyRuleRetry,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleRetry.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleRollback = pgTable("policy_rule_rollback", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),
  onJobStatuses: text("on_job_statuses").array(),
  onVerificationFailure: boolean("on_verification_failure"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const policyRuleRollbackRelations = relations(
  policyRuleRollback,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleRollback.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleVerification = pgTable("policy_rule_verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),
  metrics: jsonb("metrics").notNull().default("[]"),
  triggerOn: text("trigger_on"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const policyRuleVerificationRelations = relations(
  policyRuleVerification,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleVerification.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleVersionCooldown = pgTable(
  "policy_rule_version_cooldown",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),
    intervalSeconds: integer("interval_seconds").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const policyRuleVersionCooldownRelations = relations(
  policyRuleVersionCooldown,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleVersionCooldown.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleVersionSelector = pgTable(
  "policy_rule_version_selector",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => policy.id, { onDelete: "cascade" }),
    description: text("description"),
    selector: text("selector").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const policyRuleVersionSelectorRelations = relations(
  policyRuleVersionSelector,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleVersionSelector.policyId],
      references: [policy.id],
    }),
  }),
);
