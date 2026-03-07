import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { deployment } from "./deployment.js";
import { deploymentVersion } from "./deployment-version.js";
import { environment } from "./environment.js";
import { workspace } from "./workspace.js";

export const policyRuleSummary = pgTable(
  "policy_rule_summary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    ruleId: uuid("rule_id").notNull(),

    deploymentId: uuid("deployment_id").references(() => deployment.id, {
      onDelete: "cascade",
    }),
    environmentId: uuid("environment_id").references(() => environment.id, {
      onDelete: "cascade",
    }),
    versionId: uuid("version_id").references(() => deploymentVersion.id, {
      onDelete: "cascade",
    }),

    allowed: boolean("allowed").notNull(),
    actionRequired: boolean("action_required").notNull().default(false),
    actionType: text("action_type"),
    message: text("message").notNull(),
    details: jsonb("details").notNull().default("{}"),

    satisfiedAt: timestamp("satisfied_at", { withTimezone: true }),
    nextEvaluationAt: timestamp("next_evaluation_at", { withTimezone: true }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex().on(t.ruleId, t.deploymentId, t.environmentId, t.versionId),
    index().on(t.deploymentId, t.versionId),
    index().on(t.environmentId),
    index().on(t.workspaceId),
  ],
);

export const policyRuleSummaryRelations = relations(
  policyRuleSummary,
  ({ one }) => ({
    deployment: one(deployment, {
      fields: [policyRuleSummary.deploymentId],
      references: [deployment.id],
    }),
    environment: one(environment, {
      fields: [policyRuleSummary.environmentId],
      references: [environment.id],
    }),
    version: one(deploymentVersion, {
      fields: [policyRuleSummary.versionId],
      references: [deploymentVersion.id],
    }),
  }),
);
