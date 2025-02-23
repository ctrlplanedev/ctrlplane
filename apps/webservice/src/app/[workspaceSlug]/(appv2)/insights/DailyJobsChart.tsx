"use client";

import type { JobCondition } from "@ctrlplane/validators/jobs";
import type React from "react";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDays, endOfDay, isSameDay, subWeeks } from "date-fns";
import _ from "lodash";
import LZString from "lz-string";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import colors from "tailwindcss/colors";

import { ChartTooltip } from "@ctrlplane/ui/chart";
import { Label } from "@ctrlplane/ui/label";
import { Switch } from "@ctrlplane/ui/switch";
import {
  ColumnOperator,
  ComparisonOperator,
  DateOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobFilterType, JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";
import { dateRange } from "~/utils/date/range";

const statusColors = {
  [JobStatus.ActionRequired]: colors.yellow[500],
  [JobStatus.ExternalRunNotFound]: colors.red[700],
  [JobStatus.InvalidIntegration]: colors.amber[700],
  [JobStatus.InvalidJobAgent]: colors.amber[400],
  [JobStatus.Failure]: colors.red[600],
  [JobStatus.InProgress]: colors.blue[500],
  [JobStatus.Successful]: colors.green[500],
};

const statusLabels = {
  [JobStatus.ActionRequired]: "Action Required",
  [JobStatus.ExternalRunNotFound]: "External Run Not Found",
  [JobStatus.InvalidIntegration]: "Invalid Integration",
  [JobStatus.InvalidJobAgent]: "Invalid Job Agent",
  [JobStatus.Failure]: "Failure",
  [JobStatus.InProgress]: "In Progress",
  [JobStatus.Successful]: "Successful",
};

type DailyJobsChartProps = { workspaceId: string };

export const DailyJobsChart: React.FC<DailyJobsChartProps> = ({
  workspaceId,
}) => {
  const endDate = endOfDay(new Date());
  const startDate = subWeeks(endDate, 6);

  const [splitByStatus, setSplitByStatus] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const dailyCountsQ = api.job.config.byWorkspaceId.dailyCount.useQuery(
    { workspaceId, timezone, startDate, endDate },
    { refetchInterval: 60_000 },
  );

  const dailyCounts = dailyCountsQ.data ?? [];

  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();

  const chartData = dateRange(startDate, endDate, 1, "days").map((d) => {
    const dayData =
      dailyCounts.find((c) => isSameDay(c.date, d))?.statusCounts ??
      ({} as Record<JobStatus, number | undefined>);
    const total = _.sumBy(Object.values(dayData), (c) => c ?? 0);
    const failureCount = dayData[JobStatus.Failure] ?? 0;
    const failureRate = total > 0 ? (failureCount / total) * 100 : 0;
    const date = new Date(d).toISOString();
    return { date, ...dayData, failureRate };
  });

  return (
    <div className="space-y-4 rounded-md border p-8">
      <div className="flex items-center justify-between">
        <span className="font-medium">Jobs per day</span>
        <div className="flex items-center gap-2">
          <Switch
            checked={splitByStatus}
            onCheckedChange={setSplitByStatus}
            id="split-by-status"
          />
          <Label htmlFor="split-by-status">Split by status</Label>
        </div>
      </div>
      <div className="h-[300px] w-full">
        <ResponsiveContainer
          width="100%"
          height="100%"
          className="focus:outline-none"
        >
          <BarChart
            data={chartData}
            margin={{ left: 12, right: 12 }}
            className="focus:outline-none"
          >
            <CartesianGrid
              vertical={false}
              strokeOpacity={0.1}
              fillOpacity={0.05}
            />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tick={{
                fontSize: 14,
                fill: colors.neutral[400],
              }}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />

            <ChartTooltip
              cursor={{ opacity: 0.1 }}
              content={({ active, payload, label }) => {
                const total = _.sumBy(
                  payload?.filter((p) => p.name !== "failureRate"),
                  (p) => Number(p.value ?? 0),
                );
                const failureRate = Math.round(
                  Number(
                    payload?.find((p) => p.name === "failureRate")?.value ?? 0,
                  ),
                );
                if (active && payload?.length)
                  return (
                    <div className="space-y-2 rounded-lg border bg-background p-2 shadow-sm">
                      <div className="font-semibold">
                        {new Date(label).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </div>

                      <div className="flex flex-col">
                        <span>Total: {total}</span>
                        <span>Failure Rate: {failureRate}%</span>
                      </div>

                      <div>
                        {payload
                          .filter((p) => p.name !== "failureRate")
                          .reverse()
                          .map((entry, index) => (
                            <div
                              key={`item-${index}`}
                              className="flex items-center gap-2"
                            >
                              <div
                                className="h-3 w-3 rounded-full"
                                style={{
                                  backgroundColor:
                                    statusColors[
                                      entry.dataKey as Exclude<
                                        JobStatus,
                                        | JobStatus.Cancelled
                                        | JobStatus.Skipped
                                        | JobStatus.Pending
                                      >
                                    ],
                                }}
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
                              <span className="font-semibold">
                                {entry.value}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  );
                return null;
              }}
            />

            {Object.entries(statusColors).map(([status, color]) => (
              <Bar
                key={status}
                dataKey={status}
                stackId="jobs"
                className="cursor-pointer"
                yAxisId="right"
                fill={splitByStatus ? color : colors.blue[500]}
                activeBar={false}
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

                  const isCancelledCondition: JobCondition = {
                    type: JobFilterType.Status,
                    operator: ColumnOperator.Equals,
                    value: JobStatus.Cancelled,
                  };

                  const isPendingCondition: JobCondition = {
                    type: JobFilterType.Status,
                    operator: ColumnOperator.Equals,
                    value: JobStatus.Pending,
                  };

                  const isSkippedCondition: JobCondition = {
                    type: JobFilterType.Status,
                    operator: ColumnOperator.Equals,
                    value: JobStatus.Skipped,
                  };

                  const statusCondition: JobCondition = {
                    type: FilterType.Comparison,
                    not: true,
                    operator: ComparisonOperator.Or,
                    conditions: [
                      isCancelledCondition,
                      isPendingCondition,
                      isSkippedCondition,
                    ],
                  };

                  const filter: JobCondition = {
                    type: FilterType.Comparison,
                    operator: ComparisonOperator.And,
                    conditions: [
                      afterStartCondition,
                      beforeEndCondition,
                      statusCondition,
                    ],
                  };

                  const hash = LZString.compressToEncodedURIComponent(
                    JSON.stringify(filter),
                  );
                  const filterLink = `/${workspaceSlug}/jobs?filter=${hash}`;
                  router.push(filterLink);
                }}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
