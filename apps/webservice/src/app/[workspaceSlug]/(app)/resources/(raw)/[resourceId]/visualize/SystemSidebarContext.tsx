"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext, useState } from "react";

type ResourceNodeData =
  RouterOutputs["resource"]["visualize"]["resources"][number];

type System = ResourceNodeData["systems"][number];

type SystemSidebarContextType = {
  system: System | null;
  setSystem: Dispatch<SetStateAction<System | null>>;
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
  const [system, setSystem] = useState<System | null>(null);

  return (
    <SystemSidebarContext.Provider value={{ system, setSystem }}>
      {children}
    </SystemSidebarContext.Provider>
  );
};
