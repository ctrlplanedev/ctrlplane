"use client";

import { api } from "~/trpc/react";
import { useDeploymentVersionEnvironmentContext } from "../DeploymentVersionEnvironmentContext";

export const useHasReleaseTargets = () => {
  const { environment, deployment } = useDeploymentVersionEnvironmentContext();

  const environmentId = environment.id;
  const deploymentId = deployment.id;
  const { data, isLoading } = api.releaseTarget.list.useQuery({
    environmentId,
    deploymentId,
    limit: 0,
  });

  const numReleaseTargets = data?.total ?? 0;

  return {
    hasNoReleaseTargets: numReleaseTargets === 0,
    isReleaseTargetsLoading: isLoading,
  };
};
