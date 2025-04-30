import { relations } from "drizzle-orm";

import { user } from "../auth.js";
import { deploymentVersion } from "../deployment-version.js";
import { policy } from "../policy.js";
import { policyRuleAnyApproval } from "./approval-any.js";
import { deploymentVersionApprovalRecord } from "./approval-record.js";
import { policyRuleRoleApproval } from "./approval-role.js";
import { policyRuleUserApproval } from "./approval-user.js";
import { policyRuleDenyWindow } from "./deny-window.js";
import { policyRuleDeploymentVersionSelector } from "./deployment-selector.js";

// User relations to approval records
export const userApprovalRelations = relations(user, ({ many }) => ({
  approvalRecords: many(deploymentVersionApprovalRecord),
}));

// Approval user relations
export const policyRuleUserApprovalRelations = relations(
  policyRuleUserApproval,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleUserApproval.policyId],
      references: [policy.id],
    }),
  }),
);

// Approval role relations
export const policyRuleRoleApprovalRelations = relations(
  policyRuleRoleApproval,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleRoleApproval.policyId],
      references: [policy.id],
    }),
  }),
);

// Approval any relations
export const policyRuleAnyApprovalRelations = relations(
  policyRuleAnyApproval,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleAnyApproval.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleDenyWindowRelations = relations(
  policyRuleDenyWindow,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDenyWindow.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyDeploymentVersionSelectorRelations = relations(
  policyRuleDeploymentVersionSelector,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDeploymentVersionSelector.policyId],
      references: [policy.id],
    }),
  }),
);

export const deploymentVersionApprovalRecordRelations = relations(
  deploymentVersionApprovalRecord,
  ({ one }) => ({
    deploymentVersion: one(deploymentVersion, {
      fields: [deploymentVersionApprovalRecord.deploymentVersionId],
      references: [deploymentVersion.id],
    }),
    user: one(user, {
      fields: [deploymentVersionApprovalRecord.userId],
      references: [user.id],
    }),
  }),
);
