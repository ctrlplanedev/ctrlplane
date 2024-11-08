"use client";

import type { Workspace } from "@ctrlplane/db/schema";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import { useRouter } from "next/navigation";
import { addDays, isSameDay, startOfDay, sub } from "date-fns";
import _ from "lodash";
import * as LZString from "lz-string";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import colors from "tailwindcss/colors";

import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";
import { ChartContainer, ChartTooltip } from "@ctrlplane/ui/chart";
import {
  ComparisonOperator,
  DateOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";
import { dateRange } from "~/utils/date/range";

const statusColors = {
  [JobStatus.ActionRequired]: colors.yellow[500],
  [JobStatus.ExternalRunNotFound]: colors.red[700],
  [JobStatus.InvalidIntegration]: colors.amber[700],
  [JobStatus.InvalidJobAgent]: colors.amber[400],
  [JobStatus.Failure]: colors.red[500],
  [JobStatus.InProgress]: colors.blue[500],
  [JobStatus.Completed]: colors.green[500],
};

const statusLabels = {
  [JobStatus.ActionRequired]: "Action Required",
  [JobStatus.ExternalRunNotFound]: "External Run Not Found",
  [JobStatus.InvalidIntegration]: "Invalid Integration",
  [JobStatus.InvalidJobAgent]: "Invalid Job Agent",
  [JobStatus.Failure]: "Failure",
  [JobStatus.InProgress]: "In Progress",
  [JobStatus.Completed]: "Completed",
};

export const JobHistoryChart: React.FC<{
  workspace: Workspace;
  className?: string;
}> = ({ className, workspace }) => {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dailyCounts = api.job.config.byWorkspaceId.dailyCount.useQuery(
    { workspaceId: workspace.id, timezone },
    { refetchInterval: 60_000 },
  );

  const now = startOfDay(new Date());
  const chartData = dateRange(sub(now, { weeks: 6 }), now, 1, "days").map(
    (d) => {
      const dayData =
        dailyCounts.data?.find((c) => isSameDay(c.date, d))?.statusCounts ?? {};
      const date = new Date(d).toISOString();
      return { date, ...dayData };
    },
  );

  const targets = api.target.byWorkspaceId.list.useQuery({
    workspaceId: workspace.id,
    limit: 0,
  });
  const deployments = api.deployment.byWorkspaceId.useQuery(workspace.id, {});

  const totalJobs = dailyCounts.data?.reduce(
    (acc, c) => acc + Number(c.totalCount),
    0,
  );

  const router = useRouter();

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
              content={({ active, payload, label }) => {
                if (active && payload?.length)
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="font-semibold">
                        {new Date(label).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>
                      {payload.reverse().map((entry, index) => (
                        <div
                          key={`item-${index}`}
                          className="flex items-center gap-2"
                        >
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span>
                            {
                              statusLabels[
                                entry.name as Exclude<
                                  JobStatus,
                                  | JobStatus.Cancelled
                                  | JobStatus.Skipped
                                  | JobStatus.Pending
                                >
                              ]
                            }
                            :{" "}
                          </span>
                          <span className="font-semibold">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  );
                return null;
              }}
            />
            {Object.entries(statusColors).map(([status, color]) => (
              <Bar
                key={status}
                dataKey={status.toLowerCase()}
                stackId="jobs"
                className="cursor-pointer"
                fill={color}
                onClick={(e) => {
                  const start = new Date(e.date);
                  const end = addDays(start, 1);

                  const afterStartCondition: JobCondition = {
                    type: FilterType.CreatedAt,
                    operator: DateOperator.AfterOrOn,
                    value: start.toISOString(),
                  };

                  const beforeEndCondition: JobCondition = {
                    type: FilterType.CreatedAt,
                    operator: DateOperator.Before,
                    value: end.toISOString(),
                  };

                  const filter: JobCondition = {
                    type: FilterType.Comparison,
                    operator: ComparisonOperator.And,
                    conditions: [afterStartCondition, beforeEndCondition],
                  };

                  const hash = LZString.compressToEncodedURIComponent(
                    JSON.stringify(filter),
                  );
                  const filterLink = `/${workspace.slug}/jobs?job-filter=${hash}`;
                  router.push(filterLink);
                }}
              />
            ))}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </div>
  );
};
