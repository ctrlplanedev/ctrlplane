import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type Deployment = {
  id: string;
  name: string;
  resourceSelector?: string | null;
  description?: string | null;
  jobAgentId?: string | null;
  jobAgentConfig?: Record<string, any> | null;
  jobAgents: Array<{
    ref: string;
    config: Record<string, any>;
    selector: string;
  }>;
  systemDeployments: Array<{
    systemId: string;
    system: {
      id: string;
      name: string;

      systemEnvironments: Array<{
        systemId: string;
        environmentId: string;
      }>;
    };
  }>;
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
