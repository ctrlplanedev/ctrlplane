import type { InferSelectModel } from "drizzle-orm";
import { pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { user } from "../auth.js";
import { baseApprovalRecordFields, baseApprovalRecordValidationFields } from "./approval-base.js";
import { basePolicyRuleFields, basePolicyRuleValidationFields } from "./base.js";

// User approval rule - requires approval from a specific user
export const policyRuleUserApproval = pgTable("policy_rule_user_approval", {
  ...basePolicyRuleFields,
  
  // User who must approve
  userId: uuid("user_id")
    .notNull()
    .references(() => user.id),
});

// Approval records specific to user approval rules
export const policyRuleUserApprovalRecord = pgTable("policy_rule_user_approval_record", {
  ...baseApprovalRecordFields,
  
  // Link to the user approval rule
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => policyRuleUserApproval.id, { onDelete: "cascade" }),
});

// Validation schemas
export const policyRuleUserApprovalInsertSchema = createInsertSchema(
  policyRuleUserApproval,
  {
    ...basePolicyRuleValidationFields,
    userId: z.string().uuid(),
  },
).omit({ id: true, createdAt: true });

export const policyRuleUserApprovalRecordInsertSchema = createInsertSchema(
  policyRuleUserApprovalRecord,
  {
    ...baseApprovalRecordValidationFields,
    ruleId: z.string().uuid(),
  },
).omit({ id: true, createdAt: true, updatedAt: true });

// Export create schemas
export const createPolicyRuleUserApproval = policyRuleUserApprovalInsertSchema;
export type CreatePolicyRuleUserApproval = z.infer<typeof createPolicyRuleUserApproval>;

export const createPolicyRuleUserApprovalRecord = policyRuleUserApprovalRecordInsertSchema;
export type CreatePolicyRuleUserApprovalRecord = z.infer<typeof createPolicyRuleUserApprovalRecord>;

// Export update schemas
export const updatePolicyRuleUserApproval = policyRuleUserApprovalInsertSchema.partial();
export type UpdatePolicyRuleUserApproval = z.infer<typeof updatePolicyRuleUserApproval>;

export const updatePolicyRuleUserApprovalRecord = policyRuleUserApprovalRecordInsertSchema.partial();
export type UpdatePolicyRuleUserApprovalRecord = z.infer<typeof updatePolicyRuleUserApprovalRecord>;

// Export model types
export type PolicyRuleUserApproval = InferSelectModel<typeof policyRuleUserApproval>;
export type PolicyRuleUserApprovalRecord = InferSelectModel<typeof policyRuleUserApprovalRecord>;