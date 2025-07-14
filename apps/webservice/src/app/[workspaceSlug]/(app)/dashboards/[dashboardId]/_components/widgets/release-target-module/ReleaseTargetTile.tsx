"use client";

import React from "react";

import { Button } from "@ctrlplane/ui/button";

import type { ReleaseTargetModuleInfo } from "./release-target-module-info";
import { ReleaseTargetSummary } from "./ReleaseTargetSummary";

export const ReleaseTargetTile: React.FC<{
  releaseTarget: ReleaseTargetModuleInfo;
  setIsExpanded: (isExpanded: boolean) => void;
}> = ({ releaseTarget, setIsExpanded }) => {
  return (
    <div className="flex flex-col gap-6 p-2 text-sm">
      <ReleaseTargetSummary releaseTarget={releaseTarget} />
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm">
          Lock
        </Button>
        <Button variant="default" size="sm" onClick={() => setIsExpanded(true)}>
          Deploy
        </Button>
      </div>
    </div>
  );
};
