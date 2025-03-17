"use client";

import type { Deployment } from "@ctrlplane/db/schema";
import React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { VersionDistributionBarChart } from "./VersionDistributionBarChart";

export const ReleaseDistributionGraphPopover: React.FC<{
  children: React.ReactNode;
  deployment: Deployment;
}> = ({ children, deployment }) => {
  const showPreviousVersionDistro = 30;

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[700px]">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Release Distribution</h4>
          <p className="text-sm text-muted-foreground">
            Distribution of the latest {showPreviousVersionDistro} filtered
            releases across resources.
          </p>

          <VersionDistributionBarChart
            deploymentId={deployment.id}
            showPreviousVersionDistro={showPreviousVersionDistro}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
