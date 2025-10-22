import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { mockDeploymentDetail } from "./mockData";

type DeploymentContextType = {
  deployment: { id: string; name: string; slug: string; description?: string };
};

const DeploymentContext = createContext<DeploymentContextType | undefined>(
  undefined,
);

export const DeploymentProvider = ({ children }: { children: ReactNode }) => {
  return (
    <DeploymentContext.Provider value={{ deployment: mockDeploymentDetail }}>
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
