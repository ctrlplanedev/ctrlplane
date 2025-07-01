"use client";

import { api } from "~/trpc/react";
import { useDeploymentVersionEnvironmentContext } from "../DeploymentVersionEnvironmentContext";

export const useIsWaitingOnAnotherRelease = () => {
  const { environment, deployment, deploymentVersion } =
    useDeploymentVersionEnvironmentContext();

  const environmentId = environment.id;
  const deploymentId = deployment.id;
  const {
    data: targetsWithActiveJobs,
    isLoading: isTargetsWithActiveJobsLoading,
  } = api.releaseTarget.activeJobs.useQuery({ environmentId, deploymentId });

  const allActiveJobs = (targetsWithActiveJobs ?? []).flatMap((t) => t.jobs);
  const isWaitingOnAnotherRelease = allActiveJobs.some(
    ({ versionId }) => versionId !== deploymentVersion.id,
  );

  return {
    isWaitingOnAnotherRelease,
    isWaitingOnAnotherReleaseLoading: isTargetsWithActiveJobsLoading,
  };
};
