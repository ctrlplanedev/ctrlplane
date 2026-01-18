import type { UseFormReturn } from "react-hook-form";
import { createContext, useContext } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Form } from "~/components/ui/form";
import { useWorkspace } from "~/components/WorkspaceProvider";

const selectorSchema = z.object({
  cel: z.string().min(1, "CEL expression is required"),
});

export const policyCreateFormSchema = z.object({
  name: z.string().min(1, "Policy name is required"),
  description: z.string().optional(),
  priority: z.number().min(0, "Priority must be 0 or greater"),
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
  isSubmitting: boolean;
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
  const { workspace } = useWorkspace();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const form = useForm<PolicyCreateFormSchema>({
    resolver: zodResolver(policyCreateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      priority: 0,
      enabled: true,
      target: {
        deploymentSelector: { cel: "false" },
        environmentSelector: { cel: "false" },
        resourceSelector: { cel: "false" },
      },
    },
  });

  const createPolicyMutation = trpc.policies.create.useMutation({
    onSuccess: () => {
      toast.success("Policy created successfully");
      void utils.policies.list.invalidate({ workspaceId: workspace.id });
      form.reset();
      navigate(`/${workspace.slug}/policies`);
    },
    onError: (error: unknown) => {
      const message =
        error &&
        typeof error === "object" &&
        "message" in error &&
        typeof error.message === "string"
          ? error.message
          : "Failed to create policy";
      toast.error(message);
    },
  });

  const onSubmit = form.handleSubmit(async (data) => {
    await createPolicyMutation.mutateAsync({
      workspaceId: workspace.id,
      name: data.name,
      description: data.description?.trim() || undefined,
      priority: data.priority,
      enabled: data.enabled,
      target: data.target,
      anyApproval: data.anyApproval,
    });
  });

  const isSubmitting = createPolicyMutation.isPending;

  return (
    <PolicyFormContext.Provider value={{ form, isSubmitting }}>
      <Form {...form}>
        <form onSubmit={onSubmit}>{children}</form>
      </Form>
    </PolicyFormContext.Provider>
  );
};
