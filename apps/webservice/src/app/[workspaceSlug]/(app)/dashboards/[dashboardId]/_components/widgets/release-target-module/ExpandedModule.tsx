import React from "react";

import { Dialog, DialogContent } from "@ctrlplane/ui/dialog";

import type { ReleaseTargetModuleInfo } from "./release-target-module-info";
import { ReleaseTargetSummary } from "./ReleaseTargetSummary";
import { VersionsTable } from "./VersionsTable";

export const ExpandedReleaseTargetModule: React.FC<{
  releaseTarget: ReleaseTargetModuleInfo;
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
}> = ({ releaseTarget, isExpanded, setIsExpanded }) => {
  const { deployment, resource } = releaseTarget;
  return (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="max-w-4xl">
        <div className="flex w-full flex-col gap-4">
          <div className="text-lg font-medium">
            Deploy {deployment.name} to {resource.name}
          </div>
          <div className="flex w-full items-center justify-between">
            <ReleaseTargetSummary releaseTarget={releaseTarget} />
          </div>
          <VersionsTable releaseTarget={releaseTarget} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
