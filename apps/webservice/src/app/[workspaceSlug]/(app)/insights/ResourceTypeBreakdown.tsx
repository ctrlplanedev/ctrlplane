"use client";

import { useEffect, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import colors from "tailwindcss/colors";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { api } from "~/trpc/react";

type ResourceTypeBreakdownProps = {
  workspaceId: string;
  systemId?: string;
};

const COLORS = [
  colors.blue[500],
  colors.purple[500],
  colors.green[500],
  colors.yellow[500],
  colors.red[500],
  colors.indigo[500],
  colors.pink[500],
  colors.cyan[500],
  colors.amber[500],
  colors.emerald[500],
];

export const ResourceTypeBreakdown: React.FC<ResourceTypeBreakdownProps> = ({
  workspaceId,
  systemId,
}) => {
  const [groupBy, setGroupBy] = useState<string>("kind");

  const { data: resources, isLoading } =
    api.resource.byWorkspaceId.list.useQuery({
      workspaceId,
      limit: 500,
    });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (!resources) return;

    // Filter by system if systemId is provided
    const filteredResources = resources.items;

    // Group resources by the selected attribute
    const groupedResources = filteredResources.reduce(
      (acc, resource) => {
        let key;
        if (groupBy === "kind") {
          key = resource.kind || "Unknown";
        } else if (groupBy === "provider") {
          key = resource.provider ?? "Unknown";
        } else if (groupBy === "apiVersion") {
          key = resource.apiVersion || "Unknown";
        }

        if (!acc[key]) {
          acc[key] = 0;
        }
        acc[key]++;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Convert to chart data
    const data = Object.entries(groupedResources)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    setChartData(data);
  }, [resources, groupBy, systemId]);

  if (isLoading) {
    return (
      <Card className="rounded-md">
        <CardHeader>
          <CardTitle>Resource Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          <Skeleton className="h-full w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Resource Breakdown</CardTitle>
          <Tabs
            defaultValue="kind"
            onValueChange={setGroupBy}
            className="w-auto"
          >
            <TabsList className="h-8">
              <TabsTrigger value="kind" className="h-7 px-3 text-xs">
                Kind
              </TabsTrigger>
              <TabsTrigger value="provider" className="h-7 px-3 text-xs">
                Provider
              </TabsTrigger>
              <TabsTrigger value="apiVersion" className="h-7 px-3 text-xs">
                Version
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent className="h-[350px]">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              No resource data available
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="45%"
                labelLine={false}
                outerRadius={130}
                innerRadius={60}
                fill="#8884d8"
                dataKey="value"
                paddingAngle={1}
                label={({
                  name,
                  percent,
                }: {
                  name: string;
                  percent: number;
                }) =>
                  percent > 0.05
                    ? `${name.length > 12 ? `${name.substring(0, 12)}...` : name}`
                    : ""
                }
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    strokeWidth={0.5}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} resources`, "Count"]}
                labelFormatter={(label) => `${label}`}
                contentStyle={{
                  borderRadius: "4px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                }}
              />
              <Legend
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ paddingTop: "10px", fontSize: "12px" }}
                formatter={(value: string) =>
                  value.length > 20 ? `${value.substring(0, 20)}...` : value
                }
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
