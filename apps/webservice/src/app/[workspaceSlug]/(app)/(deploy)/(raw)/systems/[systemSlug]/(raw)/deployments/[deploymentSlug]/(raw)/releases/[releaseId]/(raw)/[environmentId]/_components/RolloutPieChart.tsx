"use client";

import { useParams } from "next/navigation";
import { Cell, Pie, PieChart } from "recharts";

import { ChartContainer, ChartTooltip } from "@ctrlplane/ui/chart";

import { COLORS } from "../_utils/colors";
import { useChartData } from "../_utils/useChartData";

export const RolloutPieChart: React.FC<{ deploymentId: string }> = ({
  deploymentId,
}) => {
  const { environmentId } = useParams<{ environmentId: string }>();
  const versionCounts = useChartData(deploymentId, environmentId);

  return (
    <ChartContainer config={{}} className="h-full w-full flex-grow">
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
