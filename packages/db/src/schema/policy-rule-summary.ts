import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { deploymentVersion } from "./deployment-version.js";
import { environment } from "./environment.js";
import { resource } from "./resource.js";

export const policyRuleEvaluation = pgTable(
  "policy_rule_evaluation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleType: text("rule_type").notNull(),
    ruleId: uuid("rule_id").notNull(),

    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => deploymentVersion.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resource.id, { onDelete: "cascade" }),

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
    uniqueIndex().on(t.ruleId, t.environmentId, t.versionId, t.resourceId),
  ],
);

export const policyRuleEvaluationRelations = relations(
  policyRuleEvaluation,
  ({ one }) => ({
    environment: one(environment, {
      fields: [policyRuleEvaluation.environmentId],
      references: [environment.id],
    }),
    version: one(deploymentVersion, {
      fields: [policyRuleEvaluation.versionId],
      references: [deploymentVersion.id],
    }),
  }),
);
