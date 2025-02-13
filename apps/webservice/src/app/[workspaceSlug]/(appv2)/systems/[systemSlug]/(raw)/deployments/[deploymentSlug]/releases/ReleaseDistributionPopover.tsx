"use client";

import type { Deployment } from "@ctrlplane/db/schema";
import React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import { ReleaseDistributionBarChart } from "./ReleaseDistributionBarChart";

export const ReleaseDistributionGraphPopover: React.FC<{
  children: React.ReactNode;
  deployment: Deployment;
}> = ({ children, deployment }) => {
  const showPreviousReleaseDistro = 30;

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[700px]">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Release Distribution</h4>
          <p className="text-sm text-muted-foreground">
            Distribution of the latest {showPreviousReleaseDistro} filtered
            releases across resources.
          </p>

          <ReleaseDistributionBarChart
            deploymentId={deployment.id}
            showPreviousReleaseDistro={showPreviousReleaseDistro}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
