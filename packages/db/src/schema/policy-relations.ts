import { relations } from "drizzle-orm";

import {
  policy,
  policyDeploymentVersionSelector,
  policyTarget,
} from "./policy.js";
import {
  policyRuleAnyApproval,
  policyRuleDenyWindow,
  policyRuleUserApproval,
  policyRuleRoleApproval,
  policyRuleTeamApproval,
} from "./rules/index.js";
import { workspace } from "./workspace.js";

// Re-export the rule relations
export * from "./rules/index.js";

export const policyRelations = relations(policy, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [policy.workspaceId],
    references: [workspace.id],
  }),
  targets: many(policyTarget),
  denyWindows: many(policyRuleDenyWindow),
  userApprovals: many(policyRuleUserApproval),
  teamApprovals: many(policyRuleTeamApproval),
  roleApprovals: many(policyRuleRoleApproval),
  anyApprovals: many(policyRuleAnyApproval),
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
