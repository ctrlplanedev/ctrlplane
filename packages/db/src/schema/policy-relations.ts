import { relations } from "drizzle-orm";

import {
  policy,
  policyDeploymentVersionSelector,
  policyTarget,
} from "./policy.js";
import {
  policyRuleAnyApproval,
  policyRuleDenyWindow,
  policyRuleRoleApproval,
  policyRuleUserApproval,
} from "./rules/index.js";
import { workspace } from "./workspace.js";

export const policyRelations = relations(policy, ({ many, one }) => ({
  workspace: one(workspace, {
    fields: [policy.workspaceId],
    references: [workspace.id],
  }),
  targets: many(policyTarget),
  denyWindows: many(policyRuleDenyWindow),
  deploymentVersionSelector: one(policyDeploymentVersionSelector, {
    fields: [policy.id],
    references: [policyDeploymentVersionSelector.policyId],
  }),

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
