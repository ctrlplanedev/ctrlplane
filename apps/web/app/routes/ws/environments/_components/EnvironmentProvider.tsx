import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type Environment = {
  id: string;
  name: string;
  systemEnvironments: Array<{
    systemId: string;
    system: {
      id: string;
      name: string;
    };
  }>;
  description?: string | null;
  resourceSelector?: string | null;
  createdAt: Date;
};

type EnvironmentContextType = {
  environment: Environment;
};

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(
  undefined,
);

export const EnvironmentProvider = ({
  environment,
  children,
}: {
  environment: Environment;
  children: ReactNode;
}) => {
  return (
    <EnvironmentContext.Provider value={{ environment }}>
      {children}
    </EnvironmentContext.Provider>
  );
};

export const useEnvironment = (): EnvironmentContextType => {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error("useEnvironment must be used within a EnvironmentProvider");
  }
  return context;
};
