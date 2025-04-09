"use client";

import type { CreatePolicy } from "@ctrlplane/db/schema";
import type { Dispatch, SetStateAction } from "react";
import type { UseFormReturn } from "react-hook-form";
import { createContext, useContext, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { createPolicy } from "@ctrlplane/db/schema";

export type PolicyTab =
  | "config"
  | "time-windows"
  | "deployment-flow"
  | "quality-security";

type PolicyContextType = {
  form: UseFormReturn<CreatePolicy>;
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
  form: {} as UseFormReturn<CreatePolicy>,
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
  workspaceId: string;
}> = ({ children, workspaceId }) => {
  const form = useForm<CreatePolicy>({
    resolver: zodResolver(createPolicy),
    defaultValues: {
      workspaceId,
      name: "",
      description: "",
      priority: 0,
      enabled: false,

      targets: [],

      denyWindows: [],
      deploymentVersionSelector: null,
      versionAnyApprovals: null,
      versionUserApprovals: [],
      versionRoleApprovals: [],
    },
  });
  const [activeTab, setActiveTab] = useState<PolicyTab>("config");
  const [policy, setPolicy] = useState<CreatePolicy>(defaultPolicy);

  return (
    <PolicyContext.Provider
      value={{ form, activeTab, setActiveTab, policy, setPolicy }}
    >
      {children}
    </PolicyContext.Provider>
  );
};

export default PolicyContext;
