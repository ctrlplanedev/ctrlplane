import type { ReleaseTargetIdentifier } from "@ctrlplane/rule-engine";

export const getReleaseTargetLockKey = (
  releaseTargetIdentifier: ReleaseTargetIdentifier,
) =>
  `release-target-mutex-${releaseTargetIdentifier.deploymentId}-${releaseTargetIdentifier.resourceId}-${releaseTargetIdentifier.environmentId}`;
