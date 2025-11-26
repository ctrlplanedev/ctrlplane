import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";

export function getRuleDisplay(rule: WorkspaceEngine["schemas"]["PolicyRule"]) {
  if (rule.anyApproval != null) return "Any Approval";
  if (rule.environmentProgression != null) return "Environment Progression";
  if (rule.gradualRollout != null) return "Gradual Rollout";
  if (rule.retry != null) return "Retry";
  if (rule.versionSelector != null) return "Version Selector";
  if (rule.deploymentDependency != null) return "Deployment Dependency";
  if (rule.id === "pausedVersions") return "Paused Versions";
  if (rule.id === "deployableVersions") return "Deployable Versions";
  return "Unknown";
}
