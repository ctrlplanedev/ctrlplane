import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type React from "react";
import { IconCircleCheck, IconCircleX } from "@tabler/icons-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useWorkspace } from "~/components/WorkspaceProvider";

type DeploymentVersion = WorkspaceEngine["schemas"]["DeploymentVersion"];
type Environment = WorkspaceEngine["schemas"]["Environment"];

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

const PolicyDecisions: React.FC<{
  version: DeploymentVersion;
  environment: Environment;
}> = ({ version, environment }) => {
  const { workspace } = useWorkspace();
  const { onClick, isPending } = useApproveDeploymentVersion(
    version.id,
    environment.id,
  );
  const decisionsQuery = trpc.environmentVersion.policyResults.useQuery({
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

export const EnvironmentActionsPanel: React.FC<
  EnvironmentActionsPanelProps
> = ({ environment, versions, open, onOpenChange }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-base">{environment.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            {versions.map((version) => (
              <PolicyDecisions
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
