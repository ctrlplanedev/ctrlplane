import type { InferSelectModel } from "drizzle-orm";
import { integer, pgTable, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import {
  baseApprovalRecordFields,
  baseApprovalRecordValidationFields,
} from "./approval-base.js";
import {
  basePolicyRuleFields,
  basePolicyRuleValidationFields,
} from "./base.js";

// Any user approval rule - requires approval from any users
export const policyRuleAnyApproval = pgTable(
  "policy_rule_any_approval",
  {
    ...basePolicyRuleFields,

    // Minimum number of approvals required from any users
    requiredApprovalsCount: integer("required_approvals_count")
      .notNull()
      .default(1),
  },
  (t) => [uniqueIndex("unique_policy_id").on(t.policyId)],
);

// Approval records specific to any approval rules
export const policyRuleAnyApprovalRecord = pgTable(
  "policy_rule_any_approval_record",
  baseApprovalRecordFields,
  (t) => ({
    uniqueRuleIdUserId: uniqueIndex("unique_rule_id_user_id").on(
      t.deploymentVersionId,
      t.userId,
    ),
  }),
);

// Validation schemas
export const policyRuleAnyApprovalInsertSchema = createInsertSchema(
  policyRuleAnyApproval,
  {
    ...basePolicyRuleValidationFields,
    requiredApprovalsCount: z.number().int().min(1).default(1),
  },
).omit({ id: true, createdAt: true });

export const policyRuleAnyApprovalRecordInsertSchema = createInsertSchema(
  policyRuleAnyApprovalRecord,
  baseApprovalRecordValidationFields,
).omit({ id: true, createdAt: true, updatedAt: true });

// Export create schemas
export const createPolicyRuleAnyApproval = policyRuleAnyApprovalInsertSchema;
export type CreatePolicyRuleAnyApproval = z.infer<
  typeof createPolicyRuleAnyApproval
>;

export const createPolicyRuleAnyApprovalRecord =
  policyRuleAnyApprovalRecordInsertSchema;
export type CreatePolicyRuleAnyApprovalRecord = z.infer<
  typeof createPolicyRuleAnyApprovalRecord
>;

// Export update schemas
export const updatePolicyRuleAnyApproval =
  policyRuleAnyApprovalInsertSchema.partial();
export type UpdatePolicyRuleAnyApproval = z.infer<
  typeof updatePolicyRuleAnyApproval
>;

export const updatePolicyRuleAnyApprovalRecord =
  policyRuleAnyApprovalRecordInsertSchema.partial();
export type UpdatePolicyRuleAnyApprovalRecord = z.infer<
  typeof updatePolicyRuleAnyApprovalRecord
>;

// Export model types
export type PolicyRuleAnyApproval = InferSelectModel<
  typeof policyRuleAnyApproval
>;
export type PolicyRuleAnyApprovalRecord = InferSelectModel<
  typeof policyRuleAnyApprovalRecord
>;
