import type { InferSelectModel } from "drizzle-orm";
import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { role } from "../rbac.js";
import {
  basePolicyRuleFields,
  basePolicyRuleValidationFields,
} from "./base.js";

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

// Validation schemas
export const policyRuleRoleApprovalInsertSchema = createInsertSchema(
  policyRuleRoleApproval,
  {
    ...basePolicyRuleValidationFields,
    roleId: z.string().uuid(),
    requiredApprovalsCount: z.number().int().min(1).default(1),
  },
).omit({ id: true, createdAt: true });

// Export create schemas
export const createPolicyRuleRoleApproval = policyRuleRoleApprovalInsertSchema;
export type CreatePolicyRuleRoleApproval = z.infer<
  typeof createPolicyRuleRoleApproval
>;

// Export update schemas
export const updatePolicyRuleRoleApproval =
  policyRuleRoleApprovalInsertSchema.partial();
export type UpdatePolicyRuleRoleApproval = z.infer<
  typeof updatePolicyRuleRoleApproval
>;

// Export model types
export type PolicyRuleRoleApproval = InferSelectModel<
  typeof policyRuleRoleApproval
>;
