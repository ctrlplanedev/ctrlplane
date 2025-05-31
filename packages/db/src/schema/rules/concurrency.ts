import { integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

import { policy } from "../policy.js";
import { basePolicyRuleFields } from "./base.js";

export const policyRuleConcurrency = pgTable("policy_rule_concurrency", {
  ...basePolicyRuleFields,

  name: text("name").notNull(),
  description: text("description"),

  policyId: uuid("policy_id")
    .notNull()
    .unique()
    .references(() => policy.id, { onDelete: "cascade" }),

  concurrency: integer("concurrency").notNull().default(1),
});

export type PolicyRuleConcurrency = typeof policyRuleConcurrency.$inferSelect;

export const createPolicyRuleConcurrency = createInsertSchema(
  policyRuleConcurrency,
);
