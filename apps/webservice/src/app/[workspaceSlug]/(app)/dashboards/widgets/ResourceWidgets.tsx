import { IconChartPie } from "@tabler/icons-react";
import _ from "lodash";
import { useMeasure } from "react-use";
import { Label, Pie, PieChart } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@ctrlplane/ui/chart";

import type { Widget } from "./spec";
import { api } from "~/trpc/react";
import { MoveButton } from "./HelperButton";
import {
  WidgetCard,
  WidgetCardCloseButton,
  WidgetCardExpandButton,
  WidgetCardHeader,
  WidgetCardTitle,
} from "./Widget";

export const WidgetResourceMetadataCount: Widget<{
  key?: string;
  countUndefined?: boolean;
}> = {
  displayName: "Resource Metadata Count",
  description: "",
  dimensions: {
    suggestedW: 2,
    suggestedH: 4,
    minW: 1,
    minH: 4,
  },
  Icon: () => <IconChartPie className="h-10 w-10" />,
  Component: ({ isEditMode, workspace }) => {
    const { data } =
      api.dashboard.widget.data.pieChart.resourceGrouping.useQuery({
        workspaceId: workspace.id,
        groupBy: ["kind"],
      });

    const [ref] = useMeasure<HTMLDivElement>();

    return (
      <WidgetCard ref={ref}>
        {isEditMode && <MoveButton className="absolute right-1 top-1.5" />}
        <WidgetCardHeader>
          <WidgetCardTitle>Kind</WidgetCardTitle>
          <WidgetCardExpandButton />
          <WidgetCardCloseButton />
        </WidgetCardHeader>

        <ChartContainer config={{}} className="h-full w-full flex-grow">
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent hideLabel className="min-w-[100px]" />
              }
            />
            <Pie
              data={
                data?.map((d, idx) => ({
                  ...d,
                  count: Number(d.count),
                  fill: `hsl(var(--chart-${idx + 1}))`,
                })) ?? []
              }
              dataKey="count"
              nameKey="label"
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
                          {data?.length ?? "-"}
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
      </WidgetCard>
    );
  },
};
