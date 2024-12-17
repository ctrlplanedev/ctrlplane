"use client";

import type { JobCondition } from "@ctrlplane/validators/jobs";
import React from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import { JobFilterType } from "@ctrlplane/validators/jobs";

import { DailyJobsChart } from "~/app/[workspaceSlug]/(app)/_components/DailyJobsChart";
import { api } from "~/trpc/react";

type JobHistoryPopoverProps = {
  deploymentId: string;
  children: React.ReactNode;
};

export const JobHistoryPopover: React.FC<JobHistoryPopoverProps> = ({
  deploymentId,
  children,
}) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dailyCounts = api.job.config.byDeploymentId.dailyCount.useQuery(
    { deploymentId, timezone },
    { refetchInterval: 60_000 },
  );

  const inDeploymentFilter: JobCondition = {
    type: JobFilterType.Deployment,
    operator: ColumnOperator.Equals,
    value: deploymentId,
  };

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-[700px]">
        <div className="space-y-2">
          <h4 className="font-medium leading-none">Job executions</h4>
          <p className="text-sm text-muted-foreground">
            Total executions of all jobs in the last 6 weeks
          </p>
          <DailyJobsChart
            dailyCounts={dailyCounts.data ?? []}
            baseFilter={inDeploymentFilter}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};
