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

import { deploymentVersion } from "./deployment-version.js";
import { environment } from "./environment.js";

export const policyRuleSummary = pgTable(
  "policy_rule_summary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ruleId: uuid("rule_id").notNull(),

    environmentId: uuid("environment_id")
      .notNull()
      .references(() => environment.id, { onDelete: "cascade" }),
    versionId: uuid("version_id")
      .notNull()
      .references(() => deploymentVersion.id, { onDelete: "cascade" }),

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
    uniqueIndex().on(t.ruleId, t.environmentId, t.versionId),
    index().on(t.environmentId, t.versionId),
  ],
);

export const policyRuleSummaryRelations = relations(
  policyRuleSummary,
  ({ one }) => ({
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
