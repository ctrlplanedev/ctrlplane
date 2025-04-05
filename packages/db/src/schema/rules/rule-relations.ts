import { relations } from "drizzle-orm";
import { policy } from "../policy.js";
import { policyRuleApproval, policyRuleApprovalRecord, policyRuleDenyWindow } from "./index.js";

export const policyRuleDenyWindowRelations = relations(
  policyRuleDenyWindow,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDenyWindow.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleApprovalRelations = relations(
  policyRuleApproval,
  ({ one, many }) => ({
    policy: one(policy, {
      fields: [policyRuleApproval.policyId],
      references: [policy.id],
    }),
    approvalRecords: many(policyRuleApprovalRecord),
  }),
);

export const policyRuleApprovalRecordRelations = relations(
  policyRuleApprovalRecord,
  ({ one }) => ({
    approvalRule: one(policyRuleApproval, {
      fields: [policyRuleApprovalRecord.approvalRuleId],
      references: [policyRuleApproval.id],
    }),
  }),
);