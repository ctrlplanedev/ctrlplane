import { useState } from "react";
import { format } from "date-fns";
import { ShieldOff, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { ExpirySelect } from "./ExpirySelect";
import { expiryOptionsForRule } from "./skip-expiry";

function RemoveSkipButton({ skipId }: { skipId: string }) {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();

  const deleteSkip = trpc.policySkips.delete.useMutation({
    onSuccess: () => {
      toast.success("Skip removal queued for this release target");
      utils.policySkips.forTarget.invalidate();
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

type TargetSkipsProps = {
  environmentId: string;
  resourceId: string;
  versionId: string;
};

export function TargetSkips({
  environmentId,
  resourceId,
  versionId,
}: TargetSkipsProps) {
  const { data: skips = [] } = trpc.policySkips.forTarget.useQuery({
    environmentId,
    resourceId,
    versionId,
  });

  if (skips.length === 0) return null;

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-4">
      <p className="text-sm font-medium">Active skips</p>
      {skips.map((skip) => (
        <div key={skip.id} className="flex items-center gap-2">
          <span className="text-sm">{skip.policyName ?? "Unknown policy"}</span>
          <span className="text-xs text-muted-foreground">
            {skip.reason}
            {skip.expiresAt != null
              ? ` · expires ${format(new Date(skip.expiresAt), "MMM d, yyyy h:mm a")}`
              : ""}
          </span>
          <div className="grow" />
          <RemoveSkipButton skipId={skip.id} />
        </div>
      ))}
    </div>
  );
}

type SkipTarget = {
  environmentId: string;
  resourceId: string;
  versionId: string;
  ruleId: string;
};

function SkipExpiryForm({
  target,
  isPending,
  onSubmit,
}: {
  target: SkipTarget;
  isPending: boolean;
  onSubmit: (expiresAt: Date | undefined) => void;
}) {
  const [now] = useState(() => new Date());
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const { data: evaluations = [] } = trpc.deploymentVersions.evaulate.useQuery({
    versionId: target.versionId,
    environmentId: target.environmentId,
  });
  const options = expiryOptionsForRule(evaluations, target.ruleId, now);
  const selected = options.find((o) => o.id === selectedId) ?? options[0];
  const expiresAt = selected?.value ?? undefined;

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Skip this rule</p>
        <p className="text-xs text-muted-foreground">
          Bypass this policy rule for this release target only.
        </p>
      </div>
      <ExpirySelect
        options={options}
        selectedId={selected?.id}
        onChange={setSelectedId}
      />
      <Button
        size="sm"
        className="w-full"
        disabled={isPending}
        onClick={() => onSubmit(expiresAt)}
      >
        Add skip
      </Button>
    </div>
  );
}

export function SkipRuleButton({ target }: { target: SkipTarget }) {
  const { workspace } = useWorkspace();
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);

  const createSkip = trpc.policySkips.createForTarget.useMutation({
    onSuccess: () => {
      toast.success("Skip queued for this release target");
      utils.policySkips.forTarget.invalidate();
      utils.releaseTargets.evaluations.invalidate();
      setOpen(false);
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
      <PopoverContent align="end" className="w-72">
        <SkipExpiryForm
          target={target}
          isPending={createSkip.isPending}
          onSubmit={(expiresAt) =>
            createSkip.mutate({
              workspaceId: workspace.id,
              environmentId: target.environmentId,
              resourceId: target.resourceId,
              versionId: target.versionId,
              ruleId: target.ruleId,
              expiresAt,
            })
          }
        />
      </PopoverContent>
    </Popover>
  );
}
