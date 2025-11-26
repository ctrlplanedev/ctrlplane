import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "~/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "~/components/ui/select";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { getRuleDisplay } from "./utils";

const formSchema = z.object({
  id: z.string(),
  expiresAt: z.date().optional(),
});
type FormSchema = z.infer<typeof formSchema>;

function useSkipForm(environmentId: string, versionId: string) {
  const { workspace } = useWorkspace();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
  });

  const utils = trpc.useUtils();

  const createSkipMutation =
    trpc.policySkips.createForEnvAndVersion.useMutation();
  const onSubmit = form.handleSubmit((data) => {
    createSkipMutation
      .mutateAsync({
        workspaceId: workspace.id,
        environmentId,
        versionId,
        ruleId: data.id,
        expiresAt: data.expiresAt,
      })
      .then(() => toast.success("Skip added"))
      .then(() => form.reset())
      .then(() =>
        utils.policySkips.forEnvAndVersion.invalidate({
          workspaceId: workspace.id,
          environmentId,
          versionId,
        }),
      );
  });

  return { form, onSubmit, isPending: createSkipMutation.isPending };
}

function RuleSelect({
  rules,
  form,
}: {
  rules: WorkspaceEngine["schemas"]["PolicyRule"][];
  form: UseFormReturn<FormSchema>;
}) {
  const selectedRuleId = form.watch("id");
  const selectedRule = rules.find((rule) => rule.id === selectedRuleId);

  return (
    <FormField
      control={form.control}
      name="id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Rule</FormLabel>
          <FormControl>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                {selectedRule ? getRuleDisplay(selectedRule) : "Select a rule"}
              </SelectTrigger>
              <SelectContent align="start">
                {rules.map((rule) => (
                  <SelectItem key={rule.id} value={rule.id}>
                    {getRuleDisplay(rule)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormControl>
        </FormItem>
      )}
    />
  );
}

function ExpiresAtSelect({ form }: { form: UseFormReturn<FormSchema> }) {
  return (
    <FormField
      control={form.control}
      name="expiresAt"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Expires At</FormLabel>
          <FormControl>
            <DateTimePicker
              value={field.value}
              onChange={field.onChange}
              placeholder="Expires at (optional)"
            />
          </FormControl>
        </FormItem>
      )}
    />
  );
}

export function CreateSkipForm({
  rules,
  environmentId,
  versionId,
}: {
  rules: WorkspaceEngine["schemas"]["PolicyRule"][];
  environmentId: string;
  versionId: string;
}) {
  const { form, onSubmit, isPending } = useSkipForm(environmentId, versionId);

  const selectedRuleId = form.watch("id");

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <h3 className="font-medium">Add new skip</h3>
        <div className="flex flex-col gap-4">
          <RuleSelect rules={rules} form={form} />
          <ExpiresAtSelect form={form} />
          <Button
            type="submit"
            size="sm"
            className="w-fit"
            disabled={selectedRuleId == null || isPending}
          >
            Add skip
          </Button>
        </div>
      </form>
    </Form>
  );
}
