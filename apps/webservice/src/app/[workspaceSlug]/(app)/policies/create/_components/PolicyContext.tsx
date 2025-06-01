"use client";

import type { CreatePolicy } from "@ctrlplane/db/schema";
import type { Dispatch, SetStateAction } from "react";
import type { UseFormReturn } from "react-hook-form";
import { createContext, useContext, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { createPolicy as policySchema } from "@ctrlplane/db/schema";
import { Form, useForm } from "@ctrlplane/ui/form";
import { toast } from "@ctrlplane/ui/toast";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import {
  convertEmptySelectorsToNull,
  isValidTarget,
} from "../../_utils/policy-targets";

export type PolicyTab =
  | "config"
  | "time-windows"
  | "deployment-flow"
  | "concurrency"
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
  enabled: true,

  targets: [],

  denyWindows: [],
  deploymentVersionSelector: null,
  versionAnyApprovals: null,
  versionUserApprovals: [],
  versionRoleApprovals: [],
  concurrency: null,
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
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();

  const form = useForm({
    mode: "onChange",
    schema: policySchema,
    defaultValues: {
      workspaceId,
      name: "",
      description: "",
      priority: 0,
      enabled: true,

      targets: [],

      denyWindows: [],
      deploymentVersionSelector: null,
      versionAnyApprovals: null,
      versionUserApprovals: [],
      versionRoleApprovals: [],
      concurrency: null,
    },
  });
  const [activeTab, setActiveTab] = useState<PolicyTab>("config");
  const [policy, setPolicy] = useState<CreatePolicy>(defaultPolicy);

  const router = useRouter();

  const utils = api.useUtils();
  const createPolicy = api.policy.create.useMutation();

  const onSubmit = form.handleSubmit((data) => {
    const targets = data.targets.map(convertEmptySelectorsToNull);
    const isTargetsValid = targets.every(isValidTarget);
    if (!isTargetsValid) {
      const errorStr = "One or more of your targets are invalid";
      form.setError("targets", { message: errorStr });
      toast.error("Error creating policy", { description: errorStr });
      return;
    }

    return createPolicy
      .mutateAsync({ ...data, workspaceId, targets })
      .then(() => {
        toast.success("Policy created successfully");
        router.push(urls.workspace(workspaceSlug).policies().baseUrl());
        utils.policy.list.invalidate();
      })
      .catch((error) => {
        toast.error("Failed to create policy", {
          description: error.message,
        });
      });
  });

  const { errors } = form.formState;
  for (const error of Object.values(errors))
    if (error.message != null)
      toast.error("Error creating policy", { description: error.message });

  return (
    <PolicyContext.Provider
      value={{ form, activeTab, setActiveTab, policy, setPolicy }}
    >
      <Form {...form}>
        <form
          onSubmit={onSubmit}
          className="flex h-full w-full flex-col overflow-hidden"
        >
          {children}
        </form>
      </Form>
    </PolicyContext.Provider>
  );
};

export default PolicyContext;
