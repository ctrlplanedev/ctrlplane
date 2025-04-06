import type { InferSelectModel } from "drizzle-orm";
import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { role } from "../rbac.js";
import { baseApprovalRecordFields, baseApprovalRecordValidationFields } from "./approval-base.js";
import { basePolicyRuleFields, basePolicyRuleValidationFields } from "./base.js";

// Role approval rule - requires approval from users with a specific role
export const policyRuleRoleApproval = pgTable("policy_rule_role_approval", {
  ...basePolicyRuleFields,
  
  // Role that can approve
  roleId: uuid("role_id")
    .notNull()
    .references(() => role.id),
  
  // Minimum number of approvals required from role holders
  requiredApprovalsCount: integer("required_approvals_count")
    .notNull()
    .default(1),
});

// Approval records specific to role approval rules
export const policyRuleRoleApprovalRecord = pgTable("policy_rule_role_approval_record", {
  ...baseApprovalRecordFields,
  
  // Link to the role approval rule
  ruleId: uuid("rule_id")
    .notNull()
    .references(() => policyRuleRoleApproval.id, { onDelete: "cascade" }),
});

// Validation schemas
export const policyRuleRoleApprovalInsertSchema = createInsertSchema(
  policyRuleRoleApproval,
  {
    ...basePolicyRuleValidationFields,
    roleId: z.string().uuid(),
    requiredApprovalsCount: z.number().int().min(1).default(1),
  },
).omit({ id: true, createdAt: true });

export const policyRuleRoleApprovalRecordInsertSchema = createInsertSchema(
  policyRuleRoleApprovalRecord,
  {
    ...baseApprovalRecordValidationFields,
    ruleId: z.string().uuid(),
  },
).omit({ id: true, createdAt: true, updatedAt: true });

// Export create schemas
export const createPolicyRuleRoleApproval = policyRuleRoleApprovalInsertSchema;
export type CreatePolicyRuleRoleApproval = z.infer<typeof createPolicyRuleRoleApproval>;

export const createPolicyRuleRoleApprovalRecord = policyRuleRoleApprovalRecordInsertSchema;
export type CreatePolicyRuleRoleApprovalRecord = z.infer<typeof createPolicyRuleRoleApprovalRecord>;

// Export update schemas
export const updatePolicyRuleRoleApproval = policyRuleRoleApprovalInsertSchema.partial();
export type UpdatePolicyRuleRoleApproval = z.infer<typeof updatePolicyRuleRoleApproval>;

export const updatePolicyRuleRoleApprovalRecord = policyRuleRoleApprovalRecordInsertSchema.partial();
export type UpdatePolicyRuleRoleApprovalRecord = z.infer<typeof updatePolicyRuleRoleApprovalRecord>;

// Export model types
export type PolicyRuleRoleApproval = InferSelectModel<typeof policyRuleRoleApproval>;
export type PolicyRuleRoleApprovalRecord = InferSelectModel<typeof policyRuleRoleApprovalRecord>;