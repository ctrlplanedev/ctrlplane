import { timestamp, uuid } from "drizzle-orm/pg-core";
import { z } from "zod";

import { policy } from "../policy.js";

// Base rule properties that all policy rules share
export const basePolicyRuleFields = {
  id: uuid("id").primaryKey().defaultRandom(),

  policyId: uuid("policy_id")
    .notNull()
    .references(() => policy.id, { onDelete: "cascade" }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

// Base validation schema fields that all policy rules share
export const basePolicyRuleValidationFields = {
  policyId: z.string().uuid(),
};
