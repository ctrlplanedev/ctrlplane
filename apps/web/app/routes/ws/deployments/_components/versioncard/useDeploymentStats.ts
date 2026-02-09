import { useMemo } from "react";
import type { ReleaseTargetWithState } from "../types";

export const useDeploymentStats = (currentReleaseTargets: ReleaseTargetWithState[], desiredReleaseTargets: ReleaseTargetWithState[]) => {
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
    const failureStatuses = [
      "failure",
      "invalidJobAgent",
      "invalidIntegration",
      "externalRunNotFound",
    ];
    const failedTargets = desiredReleaseTargets.filter((rt) => {
      // Check if state has latestJob with a failure status
      const latestJob = (rt.state as any).latestJob;
      return latestJob && failureStatuses.includes(latestJob.job?.status);
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
      failed: failedTargets.length,
      totalTargets: desiredReleaseTargets.length,
      environmentCount: new Set([...currentEnvIds, ...desiredEnvIds]).size,
    };
  }, [currentReleaseTargets, desiredReleaseTargets]);
}