"use client";

import type { DeploymentVersionCondition } from "@ctrlplane/validators/releases";
import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@ctrlplane/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";
import { Input } from "@ctrlplane/ui/input";
import { Label } from "@ctrlplane/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import {
  defaultCondition,
  isValidDeploymentVersionCondition,
} from "@ctrlplane/validators/releases";

import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { DeploymentVersionConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionDialog";
import { api } from "~/trpc/react";

type CreateVersionChannelRuleDialogProps = {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const formSchema = z.object({
  policyId: z.string().uuid("Policy selection is required"),
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

export function CreateVersionChannelRuleDialog({
  workspaceId,
  open,
  onOpenChange,
}: CreateVersionChannelRuleDialogProps) {
  const utils = api.useUtils();
  const [currentCondition, setCurrentCondition] =
    useState<DeploymentVersionCondition | null>(defaultCondition);

  // Fetch policies for the select dropdown
  const policiesQuery = api.policy.list.useQuery(workspaceId);
  const eligiblePolicies = policiesQuery.data?.filter(
    (p) => p.deploymentVersionSelector === null,
  );

  const { register, handleSubmit, formState, reset, watch } = useForm<FormData>(
    {
      resolver: zodResolver(formSchema),
      defaultValues: {
        policyId: undefined, // No default policy selected
        name: "",
        description: "",
      },
    },
  );

  const selectedPolicyId = watch("policyId"); // Watch selected policy for display/logic

  const createMutation = api.policy.createDeploymentVersionSelector.useMutation(
    {
      onSuccess: (_, variables) => {
        toast.success(`Version Selector Rule added to policy.`);
        utils.policy.list.invalidate();
        utils.policy.byId.invalidate(variables.policyId);
        reset();
        setCurrentCondition(defaultCondition);
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(`Failed to add rule: ${error.message}`);
      },
    },
  );

  const onSubmit = (data: FormData) => {
    if (
      !currentCondition ||
      !isValidDeploymentVersionCondition(currentCondition)
    ) {
      toast.error("A valid Version Selector condition is required.");
      return;
    }
    createMutation.mutate({
      policyId: data.policyId,
      name: data.name,
      description: data.description,
      deploymentVersionSelector: currentCondition,
    });
  };

  // Reset form and condition when dialog is closed/opened
  // It provides consistent cleanup for all dialog closing scenarios.
  // It resets the local currentCondition state, which react-hook-form doesn't manage.
  useEffect(() => {
    if (!open) {
      reset();
      setCurrentCondition(defaultCondition);
    }
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Version Channel Rule</DialogTitle>
          <DialogDescription>
            Add a new Version Selector rule to an existing policy.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          {/* Policy Selector */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="policyId" className="text-right">
              Policy
            </Label>
            <Select
              value={selectedPolicyId}
              onValueChange={
                (value) => reset({ ...watch(), policyId: value }) // Update form state
              }
              disabled={createMutation.isPending || policiesQuery.isLoading}
            >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a policy..." />
              </SelectTrigger>
              <SelectContent>
                {policiesQuery.isLoading && (
                  <SelectItem value="loading" disabled>
                    Loading...
                  </SelectItem>
                )}
                {eligiblePolicies && eligiblePolicies.length === 0 && (
                  <SelectItem value="none" disabled>
                    No eligible policies found (all policies already have a
                    rule).
                  </SelectItem>
                )}
                {eligiblePolicies?.map((policy) => (
                  <SelectItem key={policy.id} value={policy.id}>
                    {policy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.errors.policyId && (
              <p className="col-span-4 text-right text-sm text-red-500">
                {formState.errors.policyId.message}
              </p>
            )}
          </div>

          {/* Rule Name */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Rule Name
            </Label>
            <Input
              id="name"
              {...register("name")}
              className="col-span-3"
              disabled={createMutation.isPending}
            />
            {formState.errors.name && (
              <p className="col-span-4 text-right text-sm text-red-500">
                {formState.errors.name.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input // Consider Textarea if longer descriptions are expected
              id="description"
              {...register("description")}
              className="col-span-3"
              disabled={createMutation.isPending}
            />
          </div>

          {/* Selector Condition - Wrap Trigger Button */}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Selector</Label>
            <div className="col-span-3 flex items-center gap-2">
              {currentCondition ? (
                <DeploymentVersionConditionBadge condition={currentCondition} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  Default (no filter)
                </span>
              )}
              <DeploymentVersionConditionDialog
                condition={currentCondition}
                onChange={(
                  newCondition: DeploymentVersionCondition | null,
                  _channelId?: string | null,
                ) => {
                  setCurrentCondition(newCondition ?? defaultCondition);
                }}
                deploymentId={undefined}
              >
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={createMutation.isPending}
                >
                  Edit Selector
                </Button>
              </DeploymentVersionConditionDialog>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !selectedPolicyId}
            >
              {createMutation.isPending ? "Creating..." : "Create Rule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
