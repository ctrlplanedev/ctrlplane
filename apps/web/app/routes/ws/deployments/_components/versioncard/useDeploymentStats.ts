import { useMemo } from "react";
import type { ReleaseTargetWithState } from "../types";

const failureStatuses = [
  "failure",
  "invalidJobAgent",
  "invalidIntegration",
  "externalRunNotFound",
] as const;

export const useDeploymentStats = (
  currentReleaseTargets: ReleaseTargetWithState[],
  desiredReleaseTargets: ReleaseTargetWithState[],
) => {
  return useMemo(() => {
    const currentTargetIds = new Set(
      currentReleaseTargets.map(
        (rt) =>
          `${rt.releaseTarget.resourceId}-${rt.releaseTarget.environmentId}-${rt.releaseTarget.deploymentId}`,
      ),
    );

    // Pending: desired but not current
    const pendingTargets = desiredReleaseTargets.filter(
      (rt) =>
        !currentTargetIds.has(
          `${rt.releaseTarget.resourceId}-${rt.releaseTarget.environmentId}-${rt.releaseTarget.deploymentId}`,
        ),
    );

    // Failed: check latestJob status for failure states
    const failedTargets = desiredReleaseTargets.filter((rt) => {
      const status = rt.latestJob?.status;
      return status != null && failureStatuses.includes(status as any);
    });

    // Get unique environment IDs
    const currentEnvIds = new Set(
      currentReleaseTargets.map((rt) => rt.releaseTarget.environmentId),
    );
    const desiredEnvIds = new Set(
      desiredReleaseTargets.map((rt) => rt.releaseTarget.environmentId),
    );

    return {
      deployed: currentReleaseTargets.length,
      pending: pendingTargets.length,
      pendingTargets,
      failed: failedTargets.length,
      failedTargets,
      totalTargets: desiredReleaseTargets.length,
      environmentCount: new Set([...currentEnvIds, ...desiredEnvIds]).size,
    };
  }, [currentReleaseTargets, desiredReleaseTargets]);
};
