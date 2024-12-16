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

export const ResourceAnnotationPieChart: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const resources = api.resource.byWorkspaceId.list.useQuery({ workspaceId });
  const [showUndefined] = useState(false);
  const [annotation] = useState<string | null>(
    "kubernetes/autoscaling-enabled",
  );

  const chartData = _.chain(resources.data?.items ?? [])
    .filter((r) => showUndefined || r.metadata[annotation ?? ""] != null)
    .groupBy((r) => r.metadata[annotation ?? ""]?.toString() ?? "undefined")
    .map((resources, metadata) => ({
      metadata,
      resources: resources.length,
      fill: `var(--color-${metadata})`,
    }))
    .value();

  const chartConfig = useMemo(
    () =>
      _.chain(resources.data?.items ?? [])
        .uniqBy((r) => r.metadata[annotation ?? ""]?.toString() ?? "undefined")
        .map((r) => [
          r.metadata[annotation ?? ""],
          {
            metadata: r.metadata[annotation ?? ""]?.toString() ?? "undefined",
            color: randomColor(),
          },
        ])
        .fromPairs()
        .value(),
    [resources.data, annotation],
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
          dataKey="resources"
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
                        _.uniqBy(
                          resources.data?.items ?? [],
                          (r) => r.metadata[annotation ?? ""] ?? "",
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
