import type { InferSelectModel } from "drizzle-orm";
import { integer, pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { team } from "../team.js";
import {
  baseApprovalRecordFields,
  baseApprovalRecordValidationFields,
} from "./approval-base.js";
import {
  basePolicyRuleFields,
  basePolicyRuleValidationFields,
} from "./base.js";

// Team approval rule - requires approval from members of a team
export const policyRuleTeamApproval = pgTable("policy_rule_team_approval", {
  ...basePolicyRuleFields,

  // Team whose members can approve
  teamId: uuid("team_id")
    .notNull()
    .references(() => team.id),

  // Minimum number of approvals required from team members
  requiredApprovalsCount: integer("required_approvals_count")
    .notNull()
    .default(1),
});

// Approval records specific to team approval rules
export const policyRuleTeamApprovalRecord = pgTable(
  "policy_rule_team_approval_record",
  {
    ...baseApprovalRecordFields,

    // Link to the team approval rule
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => policyRuleTeamApproval.id, { onDelete: "cascade" }),
  },
);

// Validation schemas
export const policyRuleTeamApprovalInsertSchema = createInsertSchema(
  policyRuleTeamApproval,
  {
    ...basePolicyRuleValidationFields,
    teamId: z.string().uuid(),
    requiredApprovalsCount: z.number().int().min(1).default(1),
  },
).omit({ id: true, createdAt: true });

export const policyRuleTeamApprovalRecordInsertSchema = createInsertSchema(
  policyRuleTeamApprovalRecord,
  {
    ...baseApprovalRecordValidationFields,
    ruleId: z.string().uuid(),
  },
).omit({ id: true, createdAt: true, updatedAt: true });

// Export create schemas
export const createPolicyRuleTeamApproval = policyRuleTeamApprovalInsertSchema;
export type CreatePolicyRuleTeamApproval = z.infer<
  typeof createPolicyRuleTeamApproval
>;

export const createPolicyRuleTeamApprovalRecord =
  policyRuleTeamApprovalRecordInsertSchema;
export type CreatePolicyRuleTeamApprovalRecord = z.infer<
  typeof createPolicyRuleTeamApprovalRecord
>;

// Export update schemas
export const updatePolicyRuleTeamApproval =
  policyRuleTeamApprovalInsertSchema.partial();
export type UpdatePolicyRuleTeamApproval = z.infer<
  typeof updatePolicyRuleTeamApproval
>;

export const updatePolicyRuleTeamApprovalRecord =
  policyRuleTeamApprovalRecordInsertSchema.partial();
export type UpdatePolicyRuleTeamApprovalRecord = z.infer<
  typeof updatePolicyRuleTeamApprovalRecord
>;

// Export model types
export type PolicyRuleTeamApproval = InferSelectModel<
  typeof policyRuleTeamApproval
>;
export type PolicyRuleTeamApprovalRecord = InferSelectModel<
  typeof policyRuleTeamApprovalRecord
>;
