import { relations } from "drizzle-orm";

import {
  computedPolicyTargetDeployment,
  computedPolicyTargetEnvironment,
  computedPolicyTargetResource,
  policy,
  policyTarget,
} from "./policy.js";
import {
  policyRuleAnyApproval,
  policyRuleDenyWindow,
  policyRuleDeploymentVersionSelector,
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
  deploymentVersionSelector: one(policyRuleDeploymentVersionSelector),

  versionUserApprovals: many(policyRuleUserApproval),
  versionRoleApprovals: many(policyRuleRoleApproval),
  versionAnyApprovals: one(policyRuleAnyApproval),
}));

export const policyTargetRelations = relations(
  policyTarget,
  ({ one, many }) => ({
    policy: one(policy, {
      fields: [policyTarget.policyId],
      references: [policy.id],
    }),
    computedDeployments: many(computedPolicyTargetDeployment),
    computedEnvironments: many(computedPolicyTargetEnvironment),
    computedResources: many(computedPolicyTargetResource),
  }),
);

export const computedPolicyTargetDeploymentRelations = relations(
  computedPolicyTargetDeployment,
  ({ one }) => ({
    policyTarget: one(policyTarget, {
      fields: [computedPolicyTargetDeployment.policyTargetId],
      references: [policyTarget.id],
    }),
  }),
);

export const computedPolicyTargetEnvironmentRelations = relations(
  computedPolicyTargetEnvironment,
  ({ one }) => ({
    policyTarget: one(policyTarget, {
      fields: [computedPolicyTargetEnvironment.policyTargetId],
      references: [policyTarget.id],
    }),
  }),
);

export const computedPolicyTargetResourceRelations = relations(
  computedPolicyTargetResource,
  ({ one }) => ({
    policyTarget: one(policyTarget, {
      fields: [computedPolicyTargetResource.policyTargetId],
      references: [policyTarget.id],
    }),
  }),
);
