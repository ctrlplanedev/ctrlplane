"use client";

import { useMemo, useState } from "react";
import _ from "lodash";
import randomColor from "randomcolor";
import { Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@ctrlplane/ui/chart";

import { api } from "~/trpc/react";

export const TargetAnnotationPieChart: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const targets = api.target.byWorkspaceId.list.useQuery({ workspaceId });
  const [showUndefined] = useState(false);
  const [annotation] = useState<string | null>(
    "kubernetes/autoscaling-enabled",
  );

  const chartData = _.chain(targets.data?.items ?? [])
    .filter((t) => showUndefined || t.labels[annotation ?? ""] != null)
    .groupBy((t) => t.labels[annotation ?? ""]?.toString() ?? "undefined")
    .map((targets, label) => ({
      label,
      targets: targets.length,
      fill: `var(--color-${label})`,
    }))
    .value();

  const chartConfig = useMemo(
    () =>
      _.chain(targets.data?.items ?? [])
        .uniqBy((t) => t.labels[annotation ?? ""]?.toString() ?? "undefined")
        .map((t) => [
          t.labels[annotation ?? ""],
          {
            label: t.labels[annotation ?? ""]?.toString() ?? "undefined",
            color: randomColor(),
          },
        ])
        .fromPairs()
        .value(),
    [targets.data, annotation],
  );

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square min-h-[200px]"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel className="min-w-[180px]" />}
        />
        <Pie
          data={chartData}
          dataKey="targets"
          nameKey="label"
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
                      {
                        _.uniqBy(
                          targets.data?.items ?? [],
                          (t) => t.labels[annotation ?? ""] ?? "",
                        ).length
                      }
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 24}
                      className="fill-muted-foreground"
                    >
                      values
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
