import { relations } from "drizzle-orm";

import {
  policy,
  policyDeploymentVersionSelector,
  policyTarget,
} from "./policy.js";
import {
  policyRuleApproval,
  policyRuleDenyWindow,
} from "./rules/index.js";
import { workspace } from "./workspace.js";

// Re-export the rule relations
export {
  policyRuleApprovalRecordRelations,
  policyRuleApprovalRelations,
  policyRuleDenyWindowRelations,
} from "./rules/index.js";

export const policyRelations = relations(policy, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [policy.workspaceId],
    references: [workspace.id],
  }),
  targets: many(policyTarget),
  denyWindows: many(policyRuleDenyWindow),
  approvals: many(policyRuleApproval),
  deploymentVersionSelector: one(policyDeploymentVersionSelector, {
    fields: [policy.id],
    references: [policyDeploymentVersionSelector.policyId],
  }),
}));

export const policyTargetRelations = relations(policyTarget, ({ one }) => ({
  policy: one(policy, {
    fields: [policyTarget.policyId],
    references: [policy.id],
  }),
}));