"use client";

import type React from "react";
import { IconChartPie } from "@tabler/icons-react";
import { Cell, Pie, PieChart } from "recharts";
import colors from "tailwindcss/colors";
import { z } from "zod";

import { ChartContainer, ChartTooltip } from "@ctrlplane/ui/chart";

import type { DashboardWidget } from "../../DashboardWidget";
import { api } from "~/trpc/react";
import { DashboardWidgetCard, WidgetFullscreen } from "../../DashboardWidget";
import { WidgetEdit } from "./Edit";

export const schema = z.object({
  deploymentId: z.string().uuid(),
  environmentIds: z.array(z.string().uuid()).optional(),
});

const COLORS = [
  colors.blue[500],
  colors.green[500],
  colors.yellow[500],
  colors.red[500],
  colors.purple[500],
  colors.amber[500],
  colors.cyan[500],
  colors.fuchsia[500],
  colors.lime[500],
  colors.orange[500],
  colors.pink[500],
  colors.teal[500],
];

const DistroChart: React.FC<{
  versionCounts: { versionTag: string; count: number }[];
}> = ({ versionCounts }) => {
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
          {versionCounts.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
};

export const WidgetDeploymentVersionDistribution: DashboardWidget = {
  displayName: "Version Distribution",
  Icon: (props) => <IconChartPie {...props} />,
  Component: ({ widget }) => {
    const { config } = widget;
    const parsedConfig = schema.safeParse(config);
    const isValidConfig = parsedConfig.success;

    const { data, isLoading } =
      api.dashboard.widget.data.deploymentVersionDistribution.useQuery(
        {
          deploymentId: parsedConfig.data?.deploymentId ?? "",
          environmentIds: parsedConfig.data?.environmentIds,
        },
        { enabled: isValidConfig },
      );

    const versionCounts = data ?? [];

    if (!isValidConfig || (!isLoading && versionCounts.length === 0))
      return (
        <DashboardWidgetCard
          widget={widget}
          WidgetFullscreen={
            <WidgetFullscreen
              widget={widget}
              WidgetExpanded={<DistroChart versionCounts={versionCounts} />}
              WidgetEditing={
                <WidgetEdit
                  widget={widget}
                  deploymentId={parsedConfig.data?.deploymentId ?? ""}
                  environmentIds={parsedConfig.data?.environmentIds}
                />
              }
            />
          }
        >
          <div className="flex h-full w-full items-center justify-center">
            <p className="text-sm text-muted-foreground">Invalid config</p>
          </div>
        </DashboardWidgetCard>
      );

    return (
      <DashboardWidgetCard
        widget={widget}
        WidgetFullscreen={
          <WidgetFullscreen
            widget={widget}
            WidgetExpanded={<DistroChart versionCounts={versionCounts} />}
            WidgetEditing={
              <WidgetEdit
                widget={widget}
                deploymentId={parsedConfig.data.deploymentId}
                environmentIds={parsedConfig.data.environmentIds}
              />
            }
          />
        }
      >
        <DistroChart versionCounts={versionCounts} />
      </DashboardWidgetCard>
    );
  },
};
