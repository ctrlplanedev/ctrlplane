"use client";

import type React from "react";
import {
  IconChartPie,
  IconEye,
  IconLoader2,
  IconPencil,
} from "@tabler/icons-react";
import { Cell, Pie, PieChart } from "recharts";
import colors from "tailwindcss/colors";

import { Button } from "@ctrlplane/ui/button";
import { ChartContainer, ChartTooltip } from "@ctrlplane/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ctrlplane/ui/dialog";

import type { Widget } from "../../DashboardWidget";
import type { WidgetSchema } from "./schema";
import { api } from "~/trpc/react";
import { MoveButton } from "../../MoveButton";
import { WidgetEdit } from "./Edit";
import { getIsValidConfig } from "./schema";

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

const WidgetExpanded: React.FC<{
  isExpanded: boolean;
  config: WidgetSchema;
  setIsExpanded: (isExpanded: boolean) => void;
  versionCounts: { versionTag: string; count: number }[];
}> = ({ isExpanded, setIsExpanded, config, versionCounts }) => {
  const isValidConfig = getIsValidConfig(config);

  const { data, isLoading } = api.deployment.byId.useQuery(
    config.deploymentId,
    { enabled: isValidConfig && isExpanded },
  );

  return (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="space-y-4">
        {isLoading && (
          <div className="flex h-full w-full items-center justify-center">
            <IconLoader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {!isLoading && (
          <>
            <DialogHeader>
              <DialogTitle>
                {config.name !== ""
                  ? config.name
                  : (data?.name ?? "Version Distribution")}
              </DialogTitle>
              <DialogDescription>
                View the version distribution of{" "}
                {data?.name ?? "this deployment"} across{" "}
                {config.environmentIds == null ||
                config.environmentIds.length === 0
                  ? "all"
                  : config.environmentIds.length}{" "}
                environments.
              </DialogDescription>
            </DialogHeader>
            <DistroChart versionCounts={versionCounts} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export const WidgetDeploymentVersionDistribution: Widget<WidgetSchema> = {
  displayName: "Version Distribution",
  description: "A module to display the version distribution of a deployment",
  Icon: () => <IconChartPie className="h-10 w-10 stroke-1" />,
  Component: (props) => {
    const { config, isEditMode, setIsExpanded, setIsEditing, isEditing } =
      props;

    const isValidConfig = getIsValidConfig(config);

    const { data, isLoading } =
      api.dashboard.widget.data.deploymentVersionDistribution.useQuery(config, {
        enabled: isValidConfig,
      });

    if (isLoading) return <div>Loading...</div>;

    const versionCounts = data ?? [];

    console.log("versionCounts", versionCounts);

    return (
      <>
        <div className="flex h-full w-full flex-col rounded-md border p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{config.name}</span>
            {isEditMode && (
              <div className="flex flex-shrink-0 items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsEditing(!isEditing)}
                  disabled={!isEditMode}
                  className="h-6 w-6"
                >
                  <IconPencil className="h-4 w-4" />
                </Button>
                <MoveButton />
              </div>
            )}
            {!isEditMode && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(true)}
                className="h-6 w-6"
              >
                <IconEye className="h-4 w-4" />
              </Button>
            )}
          </div>
          <DistroChart versionCounts={versionCounts} />
        </div>
        <WidgetExpanded {...props} versionCounts={versionCounts} />
        <WidgetEdit {...props} />
      </>
    );
  },
};
