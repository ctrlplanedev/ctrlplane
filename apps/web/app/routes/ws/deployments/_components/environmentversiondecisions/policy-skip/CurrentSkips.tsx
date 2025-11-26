import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { format } from "date-fns";
import { X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { getRuleDisplay } from "./utils";

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

export function CurrentSkips({
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
