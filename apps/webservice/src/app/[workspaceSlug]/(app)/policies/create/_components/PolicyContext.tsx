"use client";

import type { Policy } from "@ctrlplane/rule-engine";
import { createContext, useContext, useState } from "react";

export type PolicyTab =
  | "config"
  | "time-windows"
  | "deployment-flow"
  | "quality-security";

type InsertPolicy = Omit<Policy, "createdAt" | "updatedAt" | "id">;

type PolicyContextType = {
  activeTab: PolicyTab;
  setActiveTab: (tab: PolicyTab) => void;
  policy: InsertPolicy;
  setPolicy: (policy: InsertPolicy) => void;
};

const defaultPolicy: InsertPolicy = {
  name: "",
  description: "",
  priority: 0,
  workspaceId: "",
  enabled: false,
  denyWindows: [],
  deploymentVersionSelector: null,
  versionAnyApprovals: [],
  versionUserApprovals: [],
  versionRoleApprovals: [],
};

const PolicyContext = createContext<PolicyContextType>({
  activeTab: "config",
  setActiveTab: () => {},
  policy: defaultPolicy,
  setPolicy: () => {},
});

export const usePolicyContext = () => {
  return useContext(PolicyContext);
};

export const PolicyContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<PolicyTab>("config");
  const [policy, setPolicy] = useState<InsertPolicy>(defaultPolicy);

  return (
    <PolicyContext.Provider
      value={{ activeTab, setActiveTab, policy, setPolicy }}
    >
      {children}
    </PolicyContext.Provider>
  );
};

export default PolicyContext;
