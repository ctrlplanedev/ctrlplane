"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type * as schema from "@ctrlplane/db/schema";
import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext, useState } from "react";

type ResourceNodeData =
  RouterOutputs["resource"]["visualize"]["resources"][number];

type System = ResourceNodeData["systems"][number];

type ResourceAndSystem = { resource: schema.Resource; system: System };

type SystemSidebarContextType = {
  resourceAndSystem: ResourceAndSystem | null;
  setResourceAndSystem: Dispatch<SetStateAction<ResourceAndSystem | null>>;
};

const SystemSidebarContext = createContext<SystemSidebarContextType | null>(
  null,
);

export const useSystemSidebarContext = () => {
  const context = useContext(SystemSidebarContext);
  if (!context) {
    throw new Error(
      "useSystemSidebarContext must be used within a SystemSidebarProvider",
    );
  }
  return context;
};

export const SystemSidebarProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [resourceAndSystem, setResourceAndSystem] =
    useState<ResourceAndSystem | null>(null);

  return (
    <SystemSidebarContext.Provider
      value={{ resourceAndSystem, setResourceAndSystem }}
    >
      {children}
    </SystemSidebarContext.Provider>
  );
};
