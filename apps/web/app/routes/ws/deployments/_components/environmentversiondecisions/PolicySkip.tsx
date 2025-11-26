import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type { UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
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
import { Separator } from "~/components/ui/separator";
import { useWorkspace } from "~/components/WorkspaceProvider";

function useCurrentSkips(environmentId: string, versionId: string) {
  const { workspace } = useWorkspace();
  const { data, isLoading } = trpc.policySkips.forEnvAndVersion.useQuery({
    workspaceId: workspace.id,
    environmentId,
    versionId,
  });
  return { currentSkips: data ?? [], isLoading };
}

function useDeleteSkip(skip: WorkspaceEngine["schemas"]["PolicySkip"]) {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();
  const deleteSkipMutation = trpc.policySkips.delete.useMutation();
  const onClickDelete = () => {
    deleteSkipMutation
      .mutateAsync({ workspaceId: workspace.id, skipId: skip.id })
      .then(() => toast.success("Skip deletion queued successfully"))
      .then(() =>
        utils.policySkips.forEnvAndVersion.invalidate({
          workspaceId: workspace.id,
          environmentId: skip.environmentId ?? "",
          versionId: skip.versionId,
        }),
      );
  };
  return onClickDelete;
}

function Skip({
  skip,
  rule,
}: {
  skip: WorkspaceEngine["schemas"]["PolicySkip"];
  rule: WorkspaceEngine["schemas"]["PolicyRule"];
}) {
  const onClickDelete = useDeleteSkip(skip);
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm">
        {getRuleDisplay(rule)}
        {skip.expiresAt != null ? (
          <span className="text-xs text-muted-foreground">
            Expires at {format(skip.expiresAt, "MM/dd/yyyy HH:mm")}
          </span>
        ) : null}
      </span>
      <div className="flex-grow" />
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onClickDelete}
        className="size-6"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

function CurrentSkips({
  environmentId,
  versionId,
  rules,
}: {
  environmentId: string;
  versionId: string;
  rules: WorkspaceEngine["schemas"]["PolicyRule"][];
}) {
  const { currentSkips } = useCurrentSkips(environmentId, versionId);
  if (currentSkips.length === 0) return null;
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Current skips</h3>
      {currentSkips.map((skip) => {
        const rule = rules.find((rule) => rule.id === skip.ruleId);
        if (rule == null) return null;
        return <Skip key={skip.id} skip={skip} rule={rule} />;
      })}
    </div>
  );
}

function getRuleDisplay(rule: WorkspaceEngine["schemas"]["PolicyRule"]) {
  if (rule.anyApproval != null) return "Any Approval";
  if (rule.environmentProgression != null) return "Environment Progression";
  if (rule.gradualRollout != null) return "Gradual Rollout";
  if (rule.retry != null) return "Retry";
  if (rule.versionSelector != null) return "Version Selector";
  if (rule.deploymentDependency != null) return "Deployment Dependency";
  return "Unknown";
}

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

function CreateSkip({
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

export function PolicySkipDialog({
  environmentId,
  versionId,
  children,
  policy,
}: {
  environmentId: string;
  versionId: string;
  children: React.ReactNode;
  policy?: WorkspaceEngine["schemas"]["Policy"];
}) {
  const rules = policy?.rules ?? [];

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Policy Skips</DialogTitle>
        </DialogHeader>

        <div className="px-4">
          <CurrentSkips
            environmentId={environmentId}
            versionId={versionId}
            rules={rules}
          />
        </div>

        <Separator />

        <div className="px-4 pb-4">
          <CreateSkip
            rules={rules}
            environmentId={environmentId}
            versionId={versionId}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
