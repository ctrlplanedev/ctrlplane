import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { policy } from "../policy.js";

export const policyRuleRetry = pgTable("policy_rule_retry", {
  id: uuid("id").primaryKey().defaultRandom(),

  policyId: uuid("policy_id")
    .notNull()
    .unique()
    .references(() => policy.id, { onDelete: "cascade" }),

  maxRetries: integer("max_retries").notNull(),
});

export const createPolicyRuleRetry = createInsertSchema(policyRuleRetry, {
  policyId: z.string().uuid(),
}).omit({ id: true });
