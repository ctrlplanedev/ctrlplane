import type { InferSelectModel } from "drizzle-orm";
import { integer, pgTable } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  basePolicyRuleFields,
  basePolicyRuleValidationFields,
} from "./base.js";

// Any user approval rule - requires approval from any users
export const policyRuleAnyApproval = pgTable("policy_rule_any_approval", {
  ...basePolicyRuleFields,

  // Minimum number of approvals required from any users
  requiredApprovalsCount: integer("required_approvals_count")
    .notNull()
    .default(1),
});

// Validation schemas
export const policyRuleAnyApprovalInsertSchema = createInsertSchema(
  policyRuleAnyApproval,
  {
    ...basePolicyRuleValidationFields,
    requiredApprovalsCount: z.number().int().min(1).default(1),
  },
).omit({ id: true, createdAt: true });

// Export create schemas
export const createPolicyRuleAnyApproval = policyRuleAnyApprovalInsertSchema;
export type CreatePolicyRuleAnyApproval = z.infer<
  typeof createPolicyRuleAnyApproval
>;

// Export update schemas
export const updatePolicyRuleAnyApproval =
  policyRuleAnyApprovalInsertSchema.partial();
export type UpdatePolicyRuleAnyApproval = z.infer<
  typeof updatePolicyRuleAnyApproval
>;

// Export model types
export type PolicyRuleAnyApproval = InferSelectModel<
  typeof policyRuleAnyApproval
>;
