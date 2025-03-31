import { relations } from "drizzle-orm";

import {
  policy,
  policyDeploymentVersionSelector,
  policyRuleDenyWindow,
  policyTarget,
} from "./policy.js";
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
}));

export const policyTargetRelations = relations(policyTarget, ({ one }) => ({
  policy: one(policy, {
    fields: [policyTarget.policyId],
    references: [policy.id],
  }),
}));

export const policyRuleDenyWindowRelations = relations(
  policyRuleDenyWindow,
  ({ one }) => ({
    policy: one(policy, {
      fields: [policyRuleDenyWindow.policyId],
      references: [policy.id],
    }),
  }),
);
