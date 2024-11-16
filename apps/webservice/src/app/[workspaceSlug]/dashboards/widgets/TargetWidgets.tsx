import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { IconChartPie } from "@tabler/icons-react";
import _ from "lodash";
import randomColor from "randomcolor";
import { useMeasure } from "react-use";
import { Label, Pie, PieChart } from "recharts";

import { Button } from "@ctrlplane/ui/button";
import { Card, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@ctrlplane/ui/chart";
import { Input } from "@ctrlplane/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@ctrlplane/ui/popover";

import type { Widget } from "./spec";
import { api } from "~/trpc/react";
import { useMatchSorter } from "~/utils/useMatchSorter";
import { MoveButton } from "./HelperButton";

const MetadataFilterInput: React.FC<{
  metadataKeys?: string[];
  value: string;
  onChange: (value: string) => void;
}> = ({ metadataKeys, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const filteredKeys = useMatchSorter(metadataKeys ?? [], value);
  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          onClick={(e) => e.stopPropagation()}
          className="flex-grow"
        >
          <Input
            className="m-0 border-0 p-0 text-center font-mono text-xs"
            placeholder="Key"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="max-h-[300px] overflow-x-auto p-0 text-sm"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {filteredKeys.map((k) => (
            <Button
              variant="ghost"
              size="sm"
              key={k}
              className="w-full rounded-none text-center text-xs"
              onClick={(e) => {
                e.preventDefault();
                onChange(k);
                setOpen(false);
              }}
            >
              <div className="w-full">{k}</div>
            </Button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const WidgetTargetMetadataCount: Widget<{
  key?: string;
  countUndefined?: boolean;
}> = {
  displayName: "Target Metadata Count",
  description: "",
  dimensions: {
    suggestedW: 2,
    suggestedH: 4,
    minW: 2,
    minH: 4,
  },
  ComponentPreview: () => {
    return (
      <>
        <IconChartPie className="m-auto mt-1 h-20 w-20 text-neutral-400 hover:text-white" />
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <p className="pb-2 text-neutral-400">Target Metadata Count</p>
        </div>
      </>
    );
  },
  Component: ({ config, updateConfig, isEditMode }) => {
    const countUndefined = config.countUndefined ?? false;
    const key = config.key ?? "kubernetes/autoscaling-enabled";
    const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
    const workspace = api.workspace.bySlug.useQuery(workspaceSlug);
    const targets = api.resource.byWorkspaceId.list.useQuery(
      { workspaceId: workspace.data?.id ?? "" },
      { enabled: workspace.isSuccess },
    );
    const metadataKeys = api.resource.metadataKeys.useQuery(
      workspace.data?.id ?? "",
      {
        enabled: workspace.isSuccess,
      },
    );

    const chartData = _.chain(targets.data?.items ?? [])
      .filter((t) => countUndefined || t.metadata[key] != null)
      .groupBy((t) => t.metadata[key]?.toString() ?? "undefined")
      .map((targets, metadata) => ({
        metadata,
        targets: targets.length,
        fill: `var(--color-${metadata})`,
      }))
      .value();

    const chartConfig = useMemo(
      () =>
        _.chain(targets.data?.items ?? [])
          .uniqBy((t) => t.metadata[key]?.toString() ?? "undefined")
          .map((t) => [
            t.metadata[key],
            {
              metadata: t.metadata[key]?.toString() ?? "undefined",
              color: randomColor(),
            },
          ])
          .fromPairs()
          .value(),
      [targets.data, key],
    );
    const [ref] = useMeasure<HTMLDivElement>();

    return (
      <Card
        ref={ref}
        className="relative flex h-full w-full flex-col rounded-md border"
      >
        {isEditMode && <MoveButton className="absolute right-1 top-1.5" />}

        <CardHeader className="shrink-0 pb-2">
          <CardTitle className="text-center text-xs">
            {isEditMode ? (
              <div>
                <MetadataFilterInput
                  value={key}
                  metadataKeys={metadataKeys.data}
                  onChange={(key) => updateConfig({ key })}
                />
              </div>
            ) : (
              <pre>{key}</pre>
            )}
          </CardTitle>
        </CardHeader>
        <ChartContainer
          config={chartConfig}
          className="h-full w-full flex-grow"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent hideLabel className="min-w-[100px]" />
              }
            />
            <Pie
              data={chartData}
              dataKey="targets"
              nameKey="metadata"
              innerRadius={45}
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
                              (t) => t.metadata[key] ?? "",
                            ).length
                          }
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy ?? 0) + 20}
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
        {/* </div> */}
      </Card>
    );
  },
};
