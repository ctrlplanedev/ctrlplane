"use client";

import { api } from "~/trpc/react";
import { useDeploymentVersionEnvironmentContext } from "../DeploymentVersionEnvironmentContext";

export const useBlockingRelease = () => {
  const { environment, deployment, deploymentVersion } =
    useDeploymentVersionEnvironmentContext();

  const environmentId = environment.id;
  const deploymentId = deployment.id;
  const {
    data: targetsWithActiveJobs,
    isLoading: isTargetsWithActiveJobsLoading,
  } = api.releaseTarget.activeJobs.useQuery({ environmentId, deploymentId });

  const allActiveJobs = (targetsWithActiveJobs ?? []).flatMap((t) => t.jobs);

  const blockingRelease = allActiveJobs.find(
    ({ versionId }) => versionId !== deploymentVersion.id,
  );

  return {
    isBlockingReleaseLoading: isTargetsWithActiveJobsLoading,
    blockingRelease,
  };
};
