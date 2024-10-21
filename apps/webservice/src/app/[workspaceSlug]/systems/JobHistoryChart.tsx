"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import { isSameDay, startOfDay, sub } from "date-fns";
import _ from "lodash";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@ctrlplane/ui/chart";

import { api } from "~/trpc/react";
import { dateRange } from "~/utils/date/range";

export const JobHistoryChart: React.FC<{
  workspace: Workspace;
  className?: string;
}> = ({ className, workspace }) => {
  const dailyCounts = api.job.config.byWorkspaceId.dailyCount.useQuery({
    workspaceId: workspace.id,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  console.log(dailyCounts.data);

  const now = startOfDay(new Date());
  const chartData = dateRange(sub(now, { weeks: 6 }), now, 1, "days").map(
    (d) => ({
      date: new Date(d).toISOString(),
      jobs:
        dailyCounts.data?.find((c) => isSameDay(c.date, d))?.totalCount ?? 0,
    }),
  );

  const targets = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
  });
  const deployments = api.deployment.byWorkspaceId.useQuery(workspace.id, {});

  const totalJobs = dailyCounts.data?.reduce(
    (acc, c) => acc + Number(c.totalCount),
    0,
  );
  console.log(totalJobs);

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
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={{
            views: { label: "Job Executions" },
            jobs: { label: "Executions", color: "hsl(var(--chart-1))" },
          }}
          className="aspect-auto h-[150px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px]"
                  nameKey="views"
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  }}
                />
              }
            />
            <Bar dataKey="jobs" fill={`hsl(var(--chart-1))`} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </div>
  );
};
