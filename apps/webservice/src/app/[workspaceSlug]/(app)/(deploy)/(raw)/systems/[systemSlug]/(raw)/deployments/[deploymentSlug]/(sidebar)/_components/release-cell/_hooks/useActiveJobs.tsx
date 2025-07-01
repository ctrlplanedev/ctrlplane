"use client";

import { api } from "~/trpc/react";
import { useDeploymentVersionEnvironmentContext } from "../DeploymentVersionEnvironmentContext";

export const useActiveJobs = () => {
  const { environment, deploymentVersion } =
    useDeploymentVersionEnvironmentContext();

  const { data: jobs, isLoading: isJobsLoading } =
    api.deployment.version.job.byEnvironment.useQuery({
      versionId: deploymentVersion.id,
      environmentId: environment.id,
    });

  const statuses = jobs?.map((j) => j.status) ?? [];

  return {
    statuses,
    isStatusesLoading: isJobsLoading,
  };
};
