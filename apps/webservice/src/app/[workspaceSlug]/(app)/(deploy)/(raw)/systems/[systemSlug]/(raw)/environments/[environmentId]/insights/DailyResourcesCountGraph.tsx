"use client";

import React from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import colors from "tailwindcss/colors";

import { ChartTooltip } from "@ctrlplane/ui/chart";

type DailyResourceCountGraphProps = {
  chartData: { date: Date; count: number }[];
};

export const DailyResourceCountGraph: React.FC<
  DailyResourceCountGraphProps
> = ({ chartData }) => (
  <ResponsiveContainer width="100%" height="100%">
    <ComposedChart data={chartData}>
      <defs>
        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.purple[500]} stopOpacity={0.4} />
          <stop offset="100%" stopColor={colors.neutral[900]} stopOpacity={0} />
        </linearGradient>
      </defs>

      <CartesianGrid vertical={false} strokeOpacity={0.1} fillOpacity={0.05} />

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
        axisLine={false}
      />
    </ComposedChart>
  </ResponsiveContainer>
);
