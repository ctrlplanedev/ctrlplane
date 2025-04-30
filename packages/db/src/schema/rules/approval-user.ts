import type { InferSelectModel } from "drizzle-orm";
import { pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { user } from "../auth.js";
import {
  basePolicyRuleFields,
  basePolicyRuleValidationFields,
} from "./base.js";

// User approval rule - requires approval from a specific user
export const policyRuleUserApproval = pgTable("policy_rule_user_approval", {
  ...basePolicyRuleFields,

  // User who must approve
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
});

// Validation schemas
export const policyRuleUserApprovalInsertSchema = createInsertSchema(
  policyRuleUserApproval,
  {
    ...basePolicyRuleValidationFields,
    userId: z.string().uuid(),
  },
).omit({ id: true, createdAt: true });

// Export create schemas
export const createPolicyRuleUserApproval = policyRuleUserApprovalInsertSchema;
export type CreatePolicyRuleUserApproval = z.infer<
  typeof createPolicyRuleUserApproval
>;

// Export update schemas
export const updatePolicyRuleUserApproval =
  policyRuleUserApprovalInsertSchema.partial();
export type UpdatePolicyRuleUserApproval = z.infer<
  typeof updatePolicyRuleUserApproval
>;

// Export model types
export type PolicyRuleUserApproval = InferSelectModel<
  typeof policyRuleUserApproval
>;
