import type { UseFormReturn } from "react-hook-form";
import { createContext, useContext } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Form } from "~/components/ui/form";

const selectorSchema = z.object({
  cel: z.string().min(1, "CEL expression is required"),
});

export const policyCreateFormSchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().optional(),
  priority: z.number().min(0, "Priority must be greater than 0"),
  enabled: z.boolean().default(true),
  target: z.object({
    deploymentSelector: selectorSchema,
    environmentSelector: selectorSchema,
    resourceSelector: selectorSchema,
  }),
  anyApproval: z
    .object({
      minApprovals: z
        .number()
        .min(1, "Minimum approvals must be greater than 0"),
    })
    .optional(),
});

export type PolicyCreateFormSchema = z.infer<typeof policyCreateFormSchema>;

type PolicyFormContextType = {
  form: UseFormReturn<PolicyCreateFormSchema>;
};

const PolicyFormContext = createContext<PolicyFormContextType | null>(null);

export function usePolicyCreateForm() {
  const context = useContext(PolicyFormContext);
  if (context == null)
    throw new Error(
      "usePolicyCreateForm must be used within a PolicyCreateFormContext",
    );
  return context;
}

export const PolicyCreateFormContextProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const form = useForm({
    resolver: zodResolver(policyCreateFormSchema),
    defaultValues: {
      name: "",
      priority: 0,
      enabled: true,
      target: {
        deploymentSelector: { cel: "false" },
        environmentSelector: { cel: "false" },
        resourceSelector: { cel: "false" },
      },
    },
  });

  const onSubmit = form.handleSubmit((data) => {
    console.log(data);
  });

  return (
    <PolicyFormContext.Provider value={{ form }}>
      <Form {...form}>
        <form onSubmit={onSubmit}>{children}</form>
      </Form>
    </PolicyFormContext.Provider>
  );
};
