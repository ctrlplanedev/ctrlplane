"use client";

import React, { useMemo } from "react";
import { subMonths } from "date-fns";
import {
  Area,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import colors from "tailwindcss/colors";

import { ChartTooltip } from "@ctrlplane/ui/chart";

import { api } from "~/trpc/react";

type DailyResourceCountGraphProps = { environmentId: string };

export const DailyResourceCountGraph: React.FC<
  DailyResourceCountGraphProps
> = ({ environmentId }) => {
  const today = useMemo(() => new Date(), []);
  const startDate = subMonths(today, 1);

  const countsQuery = api.resource.stats.dailyCount.byEnvironmentId.useQuery({
    environmentId,
    startDate,
    endDate: today,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });

  const chartData = countsQuery.data ?? [];

  return (
    <ResponsiveContainer width="100%" height={250}>
      <ComposedChart data={chartData}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={colors.purple[500]}
              stopOpacity={0.4}
            />
            <stop
              offset="100%"
              stopColor={colors.neutral[900]}
              stopOpacity={0}
            />
          </linearGradient>
        </defs>

        <ChartTooltip
          content={({ payload, label }) => {
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
                  <span>Total: {payload?.[0]?.value}</span>
                </div>
              </div>
            );
          }}
        />

        <Area
          type="monotone"
          dataKey="count"
          stroke={colors.purple[500]}
          fill="url(#colorCount)"
          fillOpacity={1}
        />
        <XAxis
          dataKey="date"
          tickLine={false}
          tickMargin={8}
          minTickGap={32}
          tickFormatter={(value) => {
            const date = new Date(value);
            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            });
          }}
          fontSize={14}
        />
        <YAxis tickLine={false} fontSize={14} />
      </ComposedChart>
    </ResponsiveContainer>
  );
};
