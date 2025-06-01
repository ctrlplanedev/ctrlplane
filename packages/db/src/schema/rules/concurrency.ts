import { integer, pgTable, uuid } from "drizzle-orm/pg-core";

import { policy } from "../policy.js";
import { basePolicyRuleFields } from "./base.js";

export const policyRuleConcurrency = pgTable("policy_rule_concurrency", {
  ...basePolicyRuleFields,

  policyId: uuid("policy_id")
    .notNull()
    .unique()
    .references(() => policy.id, { onDelete: "cascade" }),

  concurrency: integer("concurrency").notNull().default(1),
});

export type PolicyRuleConcurrency = typeof policyRuleConcurrency.$inferSelect;
