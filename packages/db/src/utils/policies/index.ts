const _true = true as const;
export const allRules = {
  denyWindows: _true,
  deploymentVersionSelector: _true,
  versionAnyApprovals: _true,
  versionUserApprovals: _true,
  versionRoleApprovals: _true,
  concurrency: _true,
  environmentVersionRollout: _true,
};

export const rulesAndTargets = { targets: _true, ...allRules };
