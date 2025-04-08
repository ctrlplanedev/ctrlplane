"use client";

import type { RouterOutputs } from "@ctrlplane/api";
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

import { DeploymentVersionConditionBadge } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionBadge";
import { DeploymentVersionConditionDialog } from "~/app/[workspaceSlug]/(app)/_components/deployments/version/condition/DeploymentVersionConditionDialog";
import { api } from "~/trpc/react";

type Policy = RouterOutputs["policy"]["list"][number];
interface PolicyWithVersionSelector extends Policy {
  deploymentVersionSelector: NonNullable<Policy["deploymentVersionSelector"]>;
}

const formSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().optional(),
});
type FormData = z.infer<typeof formSchema>;

interface VersionSelectorRuleDialogProps {
  policy: PolicyWithVersionSelector;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VersionSelectorRuleDialog({
  policy,
  open,
  onOpenChange,
}: VersionSelectorRuleDialogProps) {
  const utils = api.useUtils();
  const [showConditionDialog, setShowConditionDialog] = useState(false);

  const [currentCondition, setCurrentCondition] =
    useState<DeploymentVersionCondition | null>(
      policy.deploymentVersionSelector.deploymentVersionSelector,
    );

  const { register, handleSubmit, formState, reset } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: policy.deploymentVersionSelector.name,
      description: policy.deploymentVersionSelector.description ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: policy.deploymentVersionSelector.name,
        description: policy.deploymentVersionSelector.description ?? "",
      });
      setCurrentCondition(
        policy.deploymentVersionSelector.deploymentVersionSelector,
      );
    }
  }, [policy, open, reset]);

  const updateMutation = api.policy.updateDeploymentVersionSelector.useMutation(
    {
      onSuccess: () => {
        toast.success("Version selector rule updated");
        utils.policy.list.invalidate();
        // Consider invalidating policy.byId if used elsewhere
        // utils.policy.byId.invalidate({ id: policy.id });
        onOpenChange(false);
      },
      onError: (error) => {
        toast.error(`Update failed: ${error.message}`);
      },
    },
  );

  // TODO: Add createMutation if needed

  const onSubmit = (data: FormData) => {
    if (!currentCondition) {
      toast.error("Version selector condition cannot be empty.");
      return;
    }
    // Decide whether to create or update based on initial state?
    // For now, assuming update as it's triggered from an existing rule
    updateMutation.mutate({
      policyId: policy.id,
      data: {
        name: data.name,
        description: data.description,
        deploymentVersionSelector: currentCondition,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Version Selector Rule</DialogTitle>
          <DialogDescription>
            Update the version selector rule for policy "{policy.name}".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Rule Name
            </Label>
            <Input
              id="name"
              {...register("name")}
              className="col-span-3"
              disabled={updateMutation.isPending}
            />
            {formState.errors.name && (
              <p className="col-span-4 text-sm text-red-500">
                {formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">
              Description
            </Label>
            <Input
              id="description"
              {...register("description")}
              className="col-span-3"
              disabled={updateMutation.isPending}
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Selector</Label>
            <div className="col-span-3 flex items-center gap-2">
              {currentCondition ? (
                <DeploymentVersionConditionBadge condition={currentCondition} />
              ) : (
                <span className="text-sm text-muted-foreground">
                  No condition set
                </span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowConditionDialog(true)}
                disabled={updateMutation.isPending}
              >
                Edit Selector
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Sub-Dialog for Editing the Condition */}
      {showConditionDialog && (
        <DeploymentVersionConditionDialog
          condition={currentCondition}
          onChange={(
            newCondition: DeploymentVersionCondition | null,
            _channelId?: string | null,
          ) => {
            setCurrentCondition(newCondition);
            setShowConditionDialog(false);
          }}
          deploymentId={undefined}
        >
          <></>
        </DeploymentVersionConditionDialog>
      )}
    </Dialog>
  );
}
