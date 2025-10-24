import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type Deployment = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  jobAgentId?: string;
  systemId: string;
  resourceSelector?: { cel?: string; json?: Record<string, unknown> };
};

type DeploymentContextType = {
  deployment: Deployment;
};

const DeploymentContext = createContext<DeploymentContextType | undefined>(
  undefined,
);

export const DeploymentProvider = ({
  deployment,
  children,
}: {
  deployment: Deployment;
  children: ReactNode;
}) => {
  return (
    <DeploymentContext.Provider value={{ deployment }}>
      {children}
    </DeploymentContext.Provider>
  );
};

export const useDeployment = (): DeploymentContextType => {
  const context = useContext(DeploymentContext);
  if (context === undefined) {
    throw new Error("useDeployment must be used within a DeploymentProvider");
  }
  return context;
};
