import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type React from "react";
import { AlertCircleIcon, Check, X } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "~/api/trpc";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";

const DeploymentVersion: React.FC<{
  allEnvironments: WorkspaceEngine["schemas"]["Environment"][];
  version: WorkspaceEngine["schemas"]["DeploymentVersion"];
  environment: WorkspaceEngine["schemas"]["Environment"];
}> = ({ version, environment }) => {
  const { workspace } = useWorkspace();
  const { data, isLoading } = trpc.policies.evaluate.useQuery(
    {
      workspaceId: workspace.id,
      scope: {
        environmentId: environment.id,
        versionId: version.id,
      },
    },
    { refetchInterval: 30_000 },
  );

  const utils = trpc.useUtils();
  const approveMutation = trpc.deploymentVersions.approve.useMutation();
  const onClickApprove = () =>
    approveMutation
      .mutateAsync({
        workspaceId: workspace.id,
        deploymentVersionId: version.id,
        environmentId: environment.id,
        status: "approved",
      })
      .then(() => {
        toast.success("Approval record queued successfully");
        utils.policies.evaluate.invalidate({
          workspaceId: workspace.id,
          scope: {
            environmentId: environment.id,
            versionId: version.id,
          },
        });
      });

  if (isLoading)
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Spinner className="size-3 animate-spin" />
        Loading...
      </div>
    );

  if (data == null) return null;

  return (
    <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
      {data.policyResults.map(({ policy, ruleResults }, idx) => (
        <div key={idx} className="w-full space-y-1 rounded-lg border p-2">
          <div className="mb-2 font-semibold">
            {policy == null ? "Global Policies" : policy.name}
          </div>

          {ruleResults.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <div>
                {rule.allowed ? (
                  <Check className="size-3 text-green-500" />
                ) : rule.actionRequired ? (
                  <AlertCircleIcon className="size-3 text-red-500" />
                ) : (
                  <X className="size-3 text-green-500" />
                )}
              </div>
              <div key={idx}>{rule.message}</div>
              <div className="flex-grow" />
              <div className="text-xs text-muted-foreground">
                {rule.actionType == "approval" && (
                  <Button
                    className="h-5 bg-green-500/10 px-1.5 text-xs text-green-600 hover:bg-green-500/20 dark:text-green-400"
                    onClick={onClickApprove}
                  >
                    Approve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

type EnvironmentVersionDecisionsProps = {
  allEnvironments: WorkspaceEngine["schemas"]["Environment"][];
  environment: WorkspaceEngine["schemas"]["Environment"];
  deploymentId: string;
  versions: WorkspaceEngine["schemas"]["DeploymentVersion"][];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EnvironmentVersionDecisions({
  allEnvironments,
  environment,
  versions,
  open,
  onOpenChange,
}: EnvironmentVersionDecisionsProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b p-4">
          <DialogTitle className="text-base">{environment.name}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[calc(85vh-120px)] overflow-y-auto px-4 pb-4">
          <div className="space-y-4">
            {versions.map((version) => (
              <div className="space-y-2 rounded-lg border p-2" key={version.id}>
                <h3 className="text-sm font-semibold">
                  {version.name || version.tag}
                </h3>
                <div className="flex flex-col gap-1">
                  <DeploymentVersion
                    allEnvironments={allEnvironments}
                    version={version}
                    environment={environment}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
