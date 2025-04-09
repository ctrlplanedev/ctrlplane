"use client";

import type { CreatePolicy } from "@ctrlplane/db/schema";
import type { Dispatch, SetStateAction } from "react";
import { createContext, useContext, useState } from "react";

export type PolicyTab =
  | "config"
  | "time-windows"
  | "deployment-flow"
  | "quality-security";

type PolicyContextType = {
  activeTab: PolicyTab;
  setActiveTab: Dispatch<SetStateAction<PolicyTab>>;
  policy: CreatePolicy;
  setPolicy: Dispatch<SetStateAction<CreatePolicy>>;
};

const defaultPolicy: CreatePolicy = {
  name: "",
  description: "",
  priority: 0,
  workspaceId: "",
  enabled: false,

  targets: [],

  denyWindows: [],
  deploymentVersionSelector: null,
  versionAnyApprovals: null,
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
  const [policy, setPolicy] = useState<CreatePolicy>(defaultPolicy);

  return (
    <PolicyContext.Provider
      value={{ activeTab, setActiveTab, policy, setPolicy }}
    >
      {children}
    </PolicyContext.Provider>
  );
};

export default PolicyContext;
