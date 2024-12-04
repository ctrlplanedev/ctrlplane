"use client";

import type { Workspace } from "@ctrlplane/db/schema";

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";
import { DailyJobsChart } from "../_components/DailyJobsChart";

export const JobHistoryChart: React.FC<{
  workspace: Workspace;
  className?: string;
}> = ({ className, workspace }) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dailyCounts = api.job.config.byWorkspaceId.dailyCount.useQuery(
    { workspaceId: workspace.id, timezone },
    { refetchInterval: 60_000 },
  );

  const targets = api.resource.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
    limit: 0,
  });
  const deployments = api.deployment.byWorkspaceId.useQuery(workspace.id, {});

  const totalJobs = dailyCounts.data?.reduce(
    (acc, c) => acc + Number(c.totalCount),
    0,
  );

  return (
    <div className={className}>
      <CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
          <CardTitle>Job executions</CardTitle>
          <CardDescription>
            Total executions of all jobs in the last 6 weeks
          </CardDescription>
        </div>
        <div className="flex">
          <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <span className="text-xs text-muted-foreground">Jobs</span>
            <span className="text-lg font-bold leading-none sm:text-3xl">
              {totalJobs ?? "-"}
            </span>
          </div>

          <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <span className="text-xs text-muted-foreground">Targets</span>
            <span className="text-lg font-bold leading-none sm:text-3xl">
              {targets.data?.total ?? "-"}
            </span>
          </div>

          <div className="relative z-30 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-l sm:border-t-0 sm:px-8 sm:py-6">
            <span className="text-xs text-muted-foreground">Deployments</span>
            <span className="text-lg font-bold leading-none sm:text-3xl">
              {deployments.data?.length ?? "-"}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex px-2 sm:p-6">
        <DailyJobsChart dailyCounts={dailyCounts.data ?? []} />
      </CardContent>
    </div>
  );
};
