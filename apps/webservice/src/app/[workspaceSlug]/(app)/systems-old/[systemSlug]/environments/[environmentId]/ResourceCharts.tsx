"use client";

import type { Resource } from "@ctrlplane/db/schema";
import { useMemo } from "react";
import _ from "lodash";
import randomColor from "randomcolor";
import { Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@ctrlplane/ui/chart";

export const PieResourcesByKind: React.FC<{ resources: Resource[] }> = ({
  resources,
}) => {
  const chartData = _.chain(resources)
    .groupBy((r) => r.kind)
    .map((resources, kind) => ({
      kind,
      resources: resources.length,
      fill: `var(--color-${kind})`,
    }))
    .value();

  const chartConfig = useMemo(
    () =>
      _.chain(resources)
        .uniqBy((r) => r.kind)
        .map((r) => [r.kind, { label: r.kind, color: randomColor() }])
        .fromPairs()
        .value(),
    [resources],
  );

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[200px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel className="min-w-[180px]" />}
        />
        <Pie
          data={chartData}
          dataKey="resources"
          nameKey="kind"
          innerRadius={55}
          strokeWidth={8}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {_.uniqBy(resources, (r) => r.kind).length}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 24}
                      className="fill-muted-foreground"
                    >
                      type(s)
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};

export const PieResourcesByProvider: React.FC<{ resources: Resource[] }> = ({
  resources,
}) => {
  const chartData = _.chain(resources)
    .groupBy((r) => r.providerId)
    .map((resources, providerId) => ({
      providerId,
      resources: resources.length,
      fill: `var(--color-${providerId})`,
    }))
    .value();

  const chartConfig = useMemo(
    () =>
      _.chain(resources)
        .uniqBy((r) => r.providerId)
        .map((r) => [
          r.providerId,
          { label: r.providerId, color: randomColor() },
        ])
        .fromPairs()
        .value(),
    [resources],
  );

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square max-h-[200px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel className="min-w-[180px]" />}
        />
        <Pie
          data={chartData}
          dataKey="resources"
          nameKey="providerId"
          innerRadius={55}
          strokeWidth={8}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text
                    x={viewBox.cx}
                    y={viewBox.cy}
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    <tspan
                      x={viewBox.cx}
                      y={viewBox.cy}
                      className="fill-foreground text-3xl font-bold"
                    >
                      {_.uniqBy(resources, (r) => r.providerId).length}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 24}
                      className="fill-muted-foreground"
                    >
                      provider(s)
                    </tspan>
                  </text>
                );
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};
