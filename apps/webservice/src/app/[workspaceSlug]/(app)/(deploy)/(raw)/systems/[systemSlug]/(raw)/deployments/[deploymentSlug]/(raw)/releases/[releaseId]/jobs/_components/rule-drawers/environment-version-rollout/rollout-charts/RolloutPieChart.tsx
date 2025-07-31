"use client";

import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip } from "@ctrlplane/ui/chart";

import { COLORS } from "./colors";
import { useChartData } from "./useChartData";

export const RolloutPieChart: React.FC<{
  deploymentId: string;
  environmentId: string;
}> = ({ deploymentId, environmentId }) => {
  const versionCounts = useChartData(deploymentId, environmentId);

  return (
    <ChartContainer config={{}}>
      <PieChart>
        <ChartTooltip
          content={({ active, payload }) => {
            if (active && payload?.length) {
              return (
                <div className="flex items-center gap-4 rounded-lg border bg-background p-2 text-xs shadow-sm">
                  <div className="font-semibold">{payload[0]?.name}</div>
                  <div className="text-sm text-neutral-400">
                    {payload[0]?.value}
                  </div>
                </div>
              );
            }
          }}
        />
        <Pie data={versionCounts} dataKey="count" nameKey="versionTag">
          {versionCounts.map((_, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};
