export function getRuleDisplay(rule: Record<string, unknown> & { id: string }) {
  if ("anyApproval" in rule && rule.anyApproval != null) return "Any Approval";
  if ("environmentProgression" in rule && rule.environmentProgression != null)
    return "Environment Progression";
  if ("gradualRollout" in rule && rule.gradualRollout != null)
    return "Gradual Rollout";
  if ("retry" in rule && rule.retry != null) return "Retry";
  if ("versionSelector" in rule && rule.versionSelector != null)
    return "Version Selector";
  if ("deploymentDependency" in rule && rule.deploymentDependency != null)
    return "Deployment Dependency";
  if ("deploymentWindow" in rule && rule.deploymentWindow != null)
    return "Deployment Window";
  if ("verification" in rule && rule.verification != null)
    return "Verification";
  if ("versionCooldown" in rule && rule.versionCooldown != null)
    return "Version Cooldown";
  if ("rollback" in rule && rule.rollback != null) return "Rollback";
  if (rule.id === "pausedVersions") return "Paused Versions";
  if (rule.id === "deployableVersions") return "Deployable Versions";
  return "Unknown";
}
