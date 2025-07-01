import type * as schema from "@ctrlplane/db/schema";
import { createContext, useContext } from "react";
import { useParams } from "next/navigation";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";

type DeploymentVersionEnvironmentContextType = {
  system: { id: string; slug: string };
  environment: schema.Environment;
  deployment: schema.Deployment;
  deploymentVersion: schema.DeploymentVersion;
  isVersionPinned: boolean;
  versionUrl: string;
};

const DeploymentVersionEnvironmentContext =
  createContext<DeploymentVersionEnvironmentContextType | null>(null);

export const useDeploymentVersionEnvironmentContext = () => {
  const ctx = useContext(DeploymentVersionEnvironmentContext);
  if (ctx == null)
    throw new Error(
      "useDeploymentVersionEnvironmentContext must be used within a DeploymentVersionEnvironmentContext.Provider",
    );
  return ctx;
};

const useIsPinned = (environmentId: string, versionId: string) => {
  const { data, isLoading } =
    api.environment.versionPinning.pinnedVersions.useQuery({
      environmentId,
    });

  const isPinned = data != null && data.length === 1 && data[0] === versionId;

  return { isPinned, isPinnedVersionsLoading: isLoading };
};

export const DeploymentVersionEnvironmentProvider: React.FC<{
  system: { id: string; slug: string };
  environment: schema.Environment;
  deployment: schema.Deployment;
  deploymentVersion: schema.DeploymentVersion;
  children: React.ReactNode;
}> = ({ children, system, environment, deployment, deploymentVersion }) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const versionUrl = urls
    .workspace(workspaceSlug)
    .system(system.slug)
    .deployment(deployment.slug)
    .release(deploymentVersion.id)
    .jobs();

  const { isPinned } = useIsPinned(environment.id, deploymentVersion.id);

  return (
    <DeploymentVersionEnvironmentContext.Provider
      value={{
        system,
        environment,
        deployment,
        deploymentVersion,
        isVersionPinned: isPinned,
        versionUrl,
      }}
    >
      {children}
    </DeploymentVersionEnvironmentContext.Provider>
  );
};
