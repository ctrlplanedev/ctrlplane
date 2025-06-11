import { relations } from "drizzle-orm";

import {
  computedPolicyTargetReleaseTarget,
  policy,
  policyTarget,
} from "./policy.js";
import { releaseTarget } from "./release.js";
import { policyRuleConcurrency } from "./rules/concurrency.js";
import {
  policyRuleAnyApproval,
  policyRuleDenyWindow,
  policyRuleDeploymentVersionSelector,
  policyRuleEnvironmentVersionRollout,
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

  concurrency: one(policyRuleConcurrency),

  environmentVersionRollout: one(policyRuleEnvironmentVersionRollout),
}));

export const policyTargetRelations = relations(
  policyTarget,
  ({ one, many }) => ({
    policy: one(policy, {
      fields: [policyTarget.policyId],
      references: [policy.id],
    }),
    computedReleaseTargets: many(computedPolicyTargetReleaseTarget),
  }),
);

export const computedPolicyTargetReleaseTargetRelations = relations(
  computedPolicyTargetReleaseTarget,
  ({ one }) => ({
    policyTarget: one(policyTarget, {
      fields: [computedPolicyTargetReleaseTarget.policyTargetId],
      references: [policyTarget.id],
    }),
    releaseTarget: one(releaseTarget, {
      fields: [computedPolicyTargetReleaseTarget.releaseTargetId],
      references: [releaseTarget.id],
    }),
  }),
);
