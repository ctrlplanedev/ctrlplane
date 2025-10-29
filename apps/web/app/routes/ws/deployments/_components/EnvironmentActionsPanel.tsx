import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type React from "react";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import _ from "lodash";
import { CheckCircle, Server, Shield } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useWorkspace } from "~/components/WorkspaceProvider";

type DeploymentVersion = WorkspaceEngine["schemas"]["DeploymentVersion"];
type ReleaseTarget = WorkspaceEngine["schemas"]["ReleaseTargetWithState"];
type Environment = WorkspaceEngine["schemas"]["Environment"];

const getReleaseTargetKey = (rt: ReleaseTarget) => {
  return `${rt.releaseTarget.resourceId}-${rt.releaseTarget.environmentId}-${rt.releaseTarget.deploymentId}`;
};

type EnvironmentActionsPanelProps = {
  environment: WorkspaceEngine["schemas"]["Environment"];
  deploymentId: string;
  versions: WorkspaceEngine["schemas"]["DeploymentVersion"][];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const useApproveDeploymentVersion = (
  versionId: string,
  environmentId: string,
) => {
  const { workspace } = useWorkspace();
  const approveMutation = trpc.deploymentVersions.approve.useMutation();
  const onClick = () =>
    approveMutation
      .mutateAsync({
        workspaceId: workspace.id,
        deploymentVersionId: versionId,
        environmentId: environmentId,
        status: "approved",
      })
      .then(() => toast.success("Approval record queued successfully"));
  return { onClick, isPending: approveMutation.isPending };
};

const PendingActionsSection: React.FC<{
  version: DeploymentVersion;
  environment: Environment;
}> = ({ version, environment }) => {
  const { workspace } = useWorkspace();
  const { onClick, isPending } = useApproveDeploymentVersion(
    version.id,
    environment.id,
  );
  const decisionsQuery = trpc.decisions.environmentVersion.useQuery({
    workspaceId: workspace.id,
    environmentId: environment.id,
    versionId: version.id,
  });
  const pendingActions = (decisionsQuery.data ?? []).flatMap(
    (action) => action.ruleResults,
  );

  return (
    <div className="space-y-2 rounded-lg border p-2">
      <h3 className="text-xs font-semibold">{version.tag}</h3>
      <div className="flex flex-col gap-1">
        {pendingActions.map((decision, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            {decision.allowed && (
              <IconCircleCheck className="size-3 text-green-500" />
            )}
            {!decision.allowed && (
              <IconCircleX className="size-3 text-red-500" />
            )}
            <span className="text-xs font-semibold text-muted-foreground">
              {decision.message}
            </span>
            {decision.actionType === "approval" && (
              <>
                <div className="flex-grow" />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-5 text-xs"
                  onClick={onClick}
                  disabled={isPending}
                >
                  Approve
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const ResourceItem: React.FC<{
  releaseTarget: ReleaseTarget;
}> = ({ releaseTarget: rt }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center justify-between border-b px-2 py-1.5 last:border-b-0 hover:bg-muted/50">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-muted">
              <Server className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs">{rt.resource.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {rt.resource.kind}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5"></div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="space-y-1">
          <div className="font-semibold">{rt.resource.name}</div>
          <div className="text-[11px]">
            Current:{" "}
            <span className="font-mono">
              {rt.state.currentRelease?.version.tag ?? "-"}
            </span>
          </div>
          <div className="text-[11px]">
            Desired:{" "}
            <span className="font-mono">
              {rt.state.desiredRelease?.version.tag ?? "-"}
            </span>
          </div>
          {rt.state.latestJob?.status === "inProgress" && (
            <div className="text-[11px] text-blue-400">Update in progress</div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

const useReleaseTargets = (environmentId: string, deploymentId: string) => {
  const { workspace } = useWorkspace();
  const envReleaseTargetsQuery = trpc.environment.releaseTargets.useQuery({
    workspaceId: workspace.id,
    environmentId,
  });
  return (envReleaseTargetsQuery.data?.items ?? []).filter(
    (rt) => rt.releaseTarget.deploymentId === deploymentId,
  );
};

export const EnvironmentActionsPanel: React.FC<
  EnvironmentActionsPanelProps
> = ({ environment, deploymentId, versions, open, onOpenChange }) => {
  const envReleaseTargets = useReleaseTargets(environment.id, deploymentId);
  const totalResources = envReleaseTargets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-base">{environment.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            {versions.map((version) => (
              <PendingActionsSection
                key={version.id}
                version={version}
                environment={environment}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
