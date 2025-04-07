import { relations } from "drizzle-orm";

import { user } from "../auth.js";
import { deploymentVersion } from "../deployment-version.js";
import { policy } from "../policy.js";
import {
  policyRuleAnyApproval,
  policyRuleAnyApprovalRecord,
} from "./approval-any.js";
import {
  policyRuleRoleApproval,
  policyRuleRoleApprovalRecord,
} from "./approval-role.js";
import {
  policyRuleUserApproval,
  policyRuleUserApprovalRecord,
} from "./approval-user.js";
import { policyRuleDenyWindow } from "./deny-window.js";

// User relations to approval records
export const userApprovalRelations = relations(user, ({ many }) => ({
  userApprovalRecords: many(policyRuleUserApprovalRecord),
  roleApprovalRecords: many(policyRuleRoleApprovalRecord),
  anyApprovalRecords: many(policyRuleAnyApprovalRecord),
}));

// Approval user relations
export const policyRuleUserApprovalRelations = relations(
  policyRuleUserApproval,
  ({ many, one }) => ({
    approvalRecords: many(policyRuleUserApprovalRecord),
    policy: one(policy, {
      fields: [policyRuleUserApproval.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleUserApprovalRecordRelations = relations(
  policyRuleUserApprovalRecord,
  ({ one }) => ({
    user: one(user, {
      fields: [policyRuleUserApprovalRecord.userId],
      references: [user.id],
    }),
    deploymentVersion: one(deploymentVersion, {
      fields: [policyRuleUserApprovalRecord.deploymentVersionId],
      references: [deploymentVersion.id],
    }),
    rule: one(policyRuleUserApproval, {
      fields: [policyRuleUserApprovalRecord.ruleId],
      references: [policyRuleUserApproval.id],
    }),
  }),
);

// Approval role relations
export const policyRuleRoleApprovalRelations = relations(
  policyRuleRoleApproval,
  ({ many, one }) => ({
    approvalRecords: many(policyRuleRoleApprovalRecord),
    policy: one(policy, {
      fields: [policyRuleRoleApproval.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleRoleApprovalRecordRelations = relations(
  policyRuleRoleApprovalRecord,
  ({ one }) => ({
    user: one(user, {
      fields: [policyRuleRoleApprovalRecord.userId],
      references: [user.id],
    }),
    deploymentVersion: one(deploymentVersion, {
      fields: [policyRuleRoleApprovalRecord.deploymentVersionId],
      references: [deploymentVersion.id],
    }),
    rule: one(policyRuleRoleApproval, {
      fields: [policyRuleRoleApprovalRecord.ruleId],
      references: [policyRuleRoleApproval.id],
    }),
  }),
);

// Approval any relations
export const policyRuleAnyApprovalRelations = relations(
  policyRuleAnyApproval,
  ({ many, one }) => ({
    approvalRecords: many(policyRuleAnyApprovalRecord),
    policy: one(policy, {
      fields: [policyRuleAnyApproval.policyId],
      references: [policy.id],
    }),
  }),
);

export const policyRuleAnyApprovalRecordRelations = relations(
  policyRuleAnyApprovalRecord,
  ({ one }) => ({
    user: one(user, {
      fields: [policyRuleAnyApprovalRecord.userId],
      references: [user.id],
    }),
    deploymentVersion: one(deploymentVersion, {
      fields: [policyRuleAnyApprovalRecord.deploymentVersionId],
      references: [deploymentVersion.id],
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
