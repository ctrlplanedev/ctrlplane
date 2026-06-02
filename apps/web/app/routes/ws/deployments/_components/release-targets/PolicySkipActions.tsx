import { useState } from "react";
import { ShieldOff, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { DateTimePicker } from "~/components/ui/datetime-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useDeployment } from "../DeploymentProvider";

export type SkipDetails = {
  skip_id: string;
  skip_reason: string;
  skip_expires_at: string | null;
};

export function isSkipDetails(details: unknown): details is SkipDetails {
  if (details == null || typeof details !== "object") return false;
  const d = details as Record<string, unknown>;
  return typeof d.skip_id === "string";
}

export function RemoveSkipButton({ skipId }: { skipId: string }) {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  const deleteSkip = trpc.policySkips.delete.useMutation({
    onSuccess: () => {
      toast.success("Skip removal queued for this release target");
      utils.releaseTargets.evaluations.invalidate();
    },
    onError: (error) =>
      toast.error("Failed to remove skip", { description: error.message }),
  });

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-6 shrink-0 gap-1.5 rounded-full px-2.5 text-xs"
      disabled={deleteSkip.isPending}
      onClick={() => deleteSkip.mutate({ workspaceId: workspace.id, skipId })}
    >
      <X className="size-3" />
      Remove skip
    </Button>
  );
}

type SkipTarget = {
  environmentId: string;
  resourceId: string;
  versionId: string;
  ruleId: string;
};

export function SkipRuleButton({ target }: { target: SkipTarget }) {
  const { workspace } = useWorkspace();
  const { deployment } = useDeployment();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | undefined>(undefined);

  const createSkip = trpc.policySkips.createForTarget.useMutation({
    onSuccess: () => {
      toast.success("Skip queued for this release target");
      utils.releaseTargets.evaluations.invalidate();
      setOpen(false);
      setExpiresAt(undefined);
    },
    onError: (error) =>
      toast.error("Failed to skip rule", { description: error.message }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 shrink-0 gap-1.5 rounded-full px-2.5 text-xs"
        >
          <ShieldOff className="size-3" />
          Skip for this target
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium">Skip this rule</p>
          <p className="text-xs text-muted-foreground">
            Bypass this policy rule for this release target only.
          </p>
        </div>
        <div className="space-y-1">
          <span className="text-xs font-medium">Expires at (optional)</span>
          <DateTimePicker
            value={expiresAt}
            onChange={setExpiresAt}
            placeholder=""
          />
        </div>
        <Button
          size="sm"
          className="w-full"
          disabled={createSkip.isPending}
          onClick={() =>
            createSkip.mutate({
              workspaceId: workspace.id,
              deploymentId: deployment.id,
              environmentId: target.environmentId,
              resourceId: target.resourceId,
              versionId: target.versionId,
              ruleId: target.ruleId,
              expiresAt,
            })
          }
        >
          Add skip
        </Button>
      </PopoverContent>
    </Popover>
  );
}
