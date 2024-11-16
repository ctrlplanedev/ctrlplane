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

export const PieTargetsByKind: React.FC<{ targets: Resource[] }> = ({
  targets,
}) => {
  const chartData = _.chain(targets)
    .groupBy((t) => t.kind)
    .map((targets, kind) => ({
      kind,
      targets: targets.length,
      fill: `var(--color-${kind})`,
    }))
    .value();

  const chartConfig = useMemo(
    () =>
      _.chain(targets)
        .uniqBy((t) => t.kind)
        .map((t) => [t.kind, { label: t.kind, color: randomColor() }])
        .fromPairs()
        .value(),
    [targets],
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
          dataKey="targets"
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
                      {_.uniqBy(targets, (t) => t.kind).length}
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

export const PieTargetsByProvider: React.FC<{ targets: Resource[] }> = ({
  targets,
}) => {
  const chartData = _.chain(targets)
    .groupBy((t) => t.providerId)
    .map((targets, providerId) => ({
      providerId,
      targets: targets.length,
      fill: `var(--color-${providerId})`,
    }))
    .value();

  const chartConfig = useMemo(
    () =>
      _.chain(targets)
        .uniqBy((t) => t.providerId)
        .map((t) => [
          t.providerId,
          { label: t.providerId, color: randomColor() },
        ])
        .fromPairs()
        .value(),
    [targets],
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
          dataKey="targets"
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
                      {_.uniqBy(targets, (t) => t.providerId).length}
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
