import { relations } from "drizzle-orm";

import { policy, policyTarget } from "./policy.js";
import {
  policyDeploymentVersionSelector,
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
  deploymentVersionSelector: one(policyDeploymentVersionSelector),

  versionUserApprovals: many(policyRuleUserApproval),
  versionRoleApprovals: many(policyRuleRoleApproval),
  versionAnyApprovals: one(policyRuleAnyApproval),
}));

export const policyTargetRelations = relations(policyTarget, ({ one }) => ({
  policy: one(policy, {
    fields: [policyTarget.policyId],
    references: [policy.id],
  }),
}));
