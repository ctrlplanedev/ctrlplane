import type { ReactNode } from "react";
import { createContext, useContext } from "react";

type Resource = {
  id: string;
  identifier: string;
  name: string;
  kind: string;
  version: string;
  metadata: Record<string, string>;
  config: Record<string, unknown>;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
};

type ResourceContextType = {
  resource: Resource;
};

const ResourceContext = createContext<ResourceContextType | undefined>(
  undefined,
);

export const ResourceProvider = ({
  resource,
  children,
}: {
  resource: Resource;
  children: ReactNode;
}) => {
  return (
    <ResourceContext.Provider value={{ resource }}>
      {children}
    </ResourceContext.Provider>
  );
};

export const useResource = (): ResourceContextType => {
  const context = useContext(ResourceContext);
  if (context === undefined) {
    throw new Error("useResource must be used within a ResourceProvider");
  }
  return context;
};


