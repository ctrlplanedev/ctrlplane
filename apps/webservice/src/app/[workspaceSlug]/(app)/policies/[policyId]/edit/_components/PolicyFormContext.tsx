"use client";

import type { UpdatePolicy } from "@ctrlplane/db/schema";
import type React from "react";
import type { UseFormReturn } from "react-hook-form";
import { createContext, useContext } from "react";
import { useRouter } from "next/navigation";

import * as SCHEMA from "@ctrlplane/db/schema";
import { Form, useForm } from "@ctrlplane/ui/form";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";
import {
  convertEmptySelectorsToNull,
  isValidTarget,
} from "../../../_utils/policy-targets";

type Policy = SCHEMA.Policy & {
  targets: SCHEMA.PolicyTarget[];
  denyWindows: SCHEMA.PolicyRuleDenyWindow[];
  deploymentVersionSelector: SCHEMA.PolicyDeploymentVersionSelector | null;
  versionAnyApprovals: SCHEMA.PolicyRuleAnyApproval | null;
  versionUserApprovals: SCHEMA.PolicyRuleUserApproval[];
  versionRoleApprovals: SCHEMA.PolicyRuleRoleApproval[];
};

type PolicyFormContextType = {
  form: UseFormReturn<UpdatePolicy>;
  policy: Policy;
};

const PolicyFormContext = createContext<PolicyFormContextType | null>(null);

export function usePolicyFormContext() {
  const ctx = useContext(PolicyFormContext);
  if (ctx == null)
    throw new Error(
      "usePolicyFormContext must be used within a PolicyFormContext.Provider",
    );
  return ctx;
}

export const PolicyFormContextProvider: React.FC<{
  children: React.ReactNode;
  policy: Policy;
}> = ({ children, policy }) => {
  console.log(policy);

  const form = useForm({
    schema: SCHEMA.updatePolicy,
    defaultValues: policy,
  });

  console.log(form.getValues());

  const router = useRouter();
  const utils = api.useUtils();

  const updatePolicy = api.policy.update.useMutation();

  const onSubmit = form.handleSubmit((data) => {
    const targets =
      data.targets === undefined
        ? undefined
        : data.targets.map(convertEmptySelectorsToNull);

    const isTargetsValid =
      targets === undefined || targets.every(isValidTarget);
    if (!isTargetsValid) {
      const errorStr = "One or more of your targets are invalid";
      form.setError("targets", { message: errorStr });
      toast.error("Error creating policy", { description: errorStr });
      return;
    }

    return updatePolicy
      .mutateAsync({
        id: policy.id,
        data: { ...data, targets },
      })
      .then(() => {
        toast.success("Policy updated successfully");
        form.reset(data);
        router.refresh();
        utils.policy.byId.invalidate();
        utils.policy.list.invalidate();
      })
      .catch((error) => {
        toast.error("Failed to update policy", {
          description: error.message,
        });
      });
  });

  return (
    <PolicyFormContext.Provider value={{ form, policy }}>
      <Form {...form}>
        <form onSubmit={onSubmit}>{children}</form>
      </Form>
    </PolicyFormContext.Provider>
  );
};
