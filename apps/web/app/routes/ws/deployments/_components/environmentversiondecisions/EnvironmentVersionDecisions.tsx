import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type React from "react";

import { trpc } from "~/api/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";

const DeploymentVersion: React.FC<{
  version: WorkspaceEngine["schemas"]["DeploymentVersion"];
  environment: WorkspaceEngine["schemas"]["Environment"];
}> = ({ version, environment }) => {
  const { workspace } = useWorkspace();
  const { data, isLoading } = trpc.policies.evaluate.useQuery({
    workspaceId: workspace.id,
    scope: {
      environmentId: environment.id,
      versionId: version.id,
    },
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
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <pre>{JSON.stringify(data, null, 2)}</pre>
      {data.policyResults.map(({ policy }, idx) => (
        <div key={idx} className="border-b">
          {policy?.name}
          <pre>{JSON.stringify(policy, null, 2)}</pre>
        </div>
      ))}
    </div>
  );
};

type EnvironmentVersionDecisionsProps = {
  environment: WorkspaceEngine["schemas"]["Environment"];
  deploymentId: string;
  versions: WorkspaceEngine["schemas"]["DeploymentVersion"][];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EnvironmentVersionDecisions({
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
