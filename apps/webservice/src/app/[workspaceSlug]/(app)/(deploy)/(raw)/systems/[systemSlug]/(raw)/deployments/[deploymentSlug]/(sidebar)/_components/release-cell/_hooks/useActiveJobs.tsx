"use client";

import { api } from "~/trpc/react";
import { useDeploymentVersionEnvironmentContext } from "../DeploymentVersionEnvironmentContext";

export const useActiveJobs = () => {
  const { environment, deploymentVersion } =
    useDeploymentVersionEnvironmentContext();

  const versionId = deploymentVersion.id;
  const environmentId = environment.id;
  const { data: jobs, isLoading: isJobsLoading } =
    api.deployment.version.job.byEnvironment.useQuery(
      { versionId, environmentId },
      { refetchInterval: 2_000 },
    );

  const statuses = jobs?.map((j) => j.status) ?? [];

  return {
    statuses,
    isStatusesLoading: isJobsLoading,
  };
};
