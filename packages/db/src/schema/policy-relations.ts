import { relations } from "drizzle-orm";

import {
  policy,
  policyRuleDeploymentVersionSelector,
  policyTarget,
} from "./policy.js";
import {
  policyRuleAnyApproval,
  policyRuleDenyWindow,
  policyRuleRoleApproval,
  policyRuleUserApproval,
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
  deploymentVersionSelector: one(policyRuleDeploymentVersionSelector),

  versionUserApprovals: many(policyRuleUserApproval),
  versionRoleApprovals: many(policyRuleRoleApproval),
  versionAnyApprovals: many(policyRuleAnyApproval),
}));

export const policyTargetRelations = relations(policyTarget, ({ one }) => ({
  policy: one(policy, {
    fields: [policyTarget.policyId],
    references: [policy.id],
  }),
}));

export const policyRuleDeploymentVersionSelectorRelations = relations(
  policyRuleDeploymentVersionSelector,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDeploymentVersionSelector.policyId],
      references: [policy.id],
    }),
  }),
);
