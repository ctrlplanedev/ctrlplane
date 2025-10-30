import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import type React from "react";

import type { DeploymentVersion, Environment } from "./types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { ApprovalDecision } from "./ApprovalDecision";

type EnvironmentVersionDecisionsProps = {
  environment: WorkspaceEngine["schemas"]["Environment"];
  deploymentId: string;
  versions: WorkspaceEngine["schemas"]["DeploymentVersion"][];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function EnvironmentVersionDecisionCard(props: {
  version: DeploymentVersion;
  environment: Environment;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-2">
      <h3 className="text-xs font-semibold">{props.version.tag}</h3>
      <div className="flex flex-col gap-1">
        <ApprovalDecision {...props} />
      </div>
    </div>
  );
}

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
              <EnvironmentVersionDecisionCard
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
}
