"use client";

import { useMemo, useState } from "react";
import { uniqBy } from "lodash";
import { chain } from "lodash-es";
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

  const chartData = chain(targets.data?.items ?? [])
    .filter((t) => showUndefined || t.metadata[annotation ?? ""] != null)
    .groupBy((t) => t.metadata[annotation ?? ""]?.toString() ?? "undefined")
    .map((targets, metadata) => ({
      metadata,
      targets: targets.length,
      fill: `var(--color-${metadata})`,
    }))
    .value();

  const chartConfig = useMemo(
    () =>
      chain(targets.data?.items ?? [])
        .uniqBy((t) => t.metadata[annotation ?? ""]?.toString() ?? "undefined")
        .map((t) => [
          t.metadata[annotation ?? ""],
          {
            metadata: t.metadata[annotation ?? ""]?.toString() ?? "undefined",
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
          nameKey="metadata"
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
                        uniqBy(
                          targets.data?.items ?? [],
                          (t) => t.metadata[annotation ?? ""] ?? "",
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
