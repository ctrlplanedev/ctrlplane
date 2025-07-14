import React from "react";

import type { ReleaseTargetModuleInfo } from "./release-target-module-info";
import { ReleaseTargetSummary } from "./ReleaseTargetSummary";
import { VersionsTable } from "./VersionsTable";

export const ExpandedReleaseTargetModule: React.FC<{
  releaseTarget: ReleaseTargetModuleInfo;
}> = ({ releaseTarget }) => {
  const { deployment, resource } = releaseTarget;
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="text-lg font-medium">
        Deploy {deployment.name} to {resource.name}
      </div>
      <div className="flex w-full items-center justify-between">
        <ReleaseTargetSummary releaseTarget={releaseTarget} />
      </div>
      <VersionsTable releaseTarget={releaseTarget} />
    </div>
  );
};
