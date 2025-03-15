"use client";

import type { JobCondition } from "@ctrlplane/validators/jobs";
import type React from "react";
import { useParams, useRouter } from "next/navigation";
import { addDays, isSameDay, startOfDay, sub } from "date-fns";
import _ from "lodash";
import LZString from "lz-string";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import colors from "tailwindcss/colors";

import { ChartContainer, ChartTooltip } from "@ctrlplane/ui/chart";
import {
  ColumnOperator,
  ComparisonOperator,
  DateOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { JobFilterType, JobStatus } from "@ctrlplane/validators/jobs";

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

type DailyCount = {
  date: Date;
  totalCount: number;
  statusCounts: Record<JobStatus, number>;
};

type DailyJobsChartProps = {
  dailyCounts: DailyCount[];
  baseFilter?: JobCondition;
};

export const DailyJobsChart: React.FC<DailyJobsChartProps> = ({
  dailyCounts,
  baseFilter,
}) => {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const router = useRouter();
  const now = startOfDay(new Date());
  const chartData = dateRange(sub(now, { weeks: 6 }), now, 1, "days").map(
    (d) => {
      const dayData =
        dailyCounts.find((c) => isSameDay(c.date, d))?.statusCounts ??
        ({} as Record<JobStatus, number | undefined>);
      const total = _.sumBy(Object.values(dayData), (c) => c ?? 0);
      const failureCount = dayData[JobStatus.Failure] ?? 0;
      const failureRate = total > 0 ? (failureCount / total) * 100 : 0;
      const date = new Date(d).toISOString();
      return { date, ...dayData, failureRate };
    },
  );

  const maxFailureRate = _.maxBy(chartData, "failureRate")?.failureRate ?? 0;
  const maxLineTickDomain =
    maxFailureRate > 0 ? Math.min(100, Math.ceil(maxFailureRate * 1.1)) : 10;

  const maxDailyCount = _.maxBy(dailyCounts, "totalCount")?.totalCount ?? 0;
  const maxBarTickDomain = Math.ceil(maxDailyCount * 1.1);

  return (
    <ChartContainer
      config={{
        views: { label: "Job Executions" },
        jobs: { label: "Executions", color: "hsl(var(--chart-1))" },
      }}
      className="aspect-auto h-[275px] w-full"
    >
      <ComposedChart
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

        <YAxis
          yAxisId="left"
          orientation="left"
          tickFormatter={(value: number) => `${value.toFixed(1)}%`}
          domain={[0, maxLineTickDomain]}
        />

        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={(value: number) => `${value}`}
          domain={[0, maxBarTickDomain]}
        />

        <ChartTooltip
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
            yAxisId="right"
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
                  ...(baseFilter ? [baseFilter] : []),
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

        <Line
          yAxisId="left"
          dataKey="failureRate"
          stroke={colors.neutral[200]}
          strokeWidth={1}
          opacity={0.3}
          dot={false}
        />
      </ComposedChart>
    </ChartContainer>
  );
};
