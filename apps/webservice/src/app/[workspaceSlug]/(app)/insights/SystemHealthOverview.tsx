"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import colors from "tailwindcss/colors";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

// import { JobStatus } from "@ctrlplane/validators/jobs";

import { api } from "~/trpc/react";

type SystemHealthOverviewProps = {
  systemId: string;
  workspaceId: string;
};

export const SystemHealthOverview: React.FC<SystemHealthOverviewProps> = ({
  systemId,
  // workspaceId,
}) => {
  const { data: system, isLoading: isLoadingSystem } =
    api.system.byId.useQuery(systemId);
  const { data: resources, isLoading: isLoadingResources } =
    api.system.resources.useQuery({
      systemId,
      limit: 100,
    });

  const { data: environments, isLoading: isLoadingEnvironments } =
    api.environment.bySystemId.useQuery(systemId);

  const [healthData, setHealthData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for all data to load
    if (isLoadingSystem || isLoadingResources || isLoadingEnvironments) {
      setIsLoading(true);
      return;
    }

    setIsLoading(false);

    // Format data for the environments health chart
    if (environments && resources) {
      const envHealthData = environments.map((env) => {
        const envResources = resources.items.filter((_resource) => {
          // This is a simplified check - you'd need to implement logic to properly
          // check if a resource belongs to an environment based on filter criteria
          return true as boolean;
        });

        const total = envResources.length;
        const healthy =
          envResources.filter((r) => r.status === "healthy").length || 0;
        const unhealthy = total - healthy;

        return {
          name: env.name,
          healthy,
          unhealthy,
          total,
        };
      });

      setHealthData(envHealthData);
    }
  }, [
    system,
    resources,
    environments,
    isLoadingSystem,
    isLoadingResources,
    isLoadingEnvironments,
  ]);

  if (isLoading === true) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">System Health Overview</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px]">
          <div className="flex h-full w-full items-center justify-center">
            <Skeleton className="h-4/5 w-4/5" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const systemName = system?.name ?? "Selected System";

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">System Health Overview</CardTitle>
          <span className="text-xs text-muted-foreground">{systemName}</span>
        </div>
      </CardHeader>
      <CardContent className="h-[350px]">
        {healthData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                No health data available
              </p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={healthData}
              margin={{
                top: 10,
                right: 10,
                left: 10,
                bottom: 20,
              }}
              barSize={40}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                opacity={0.2}
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                fontSize={12}
              />
              <YAxis axisLine={false} tickLine={false} fontSize={11} />
              <Tooltip
                formatter={(value, name) => [
                  value,
                  name === "healthy" ? "Healthy" : "Unhealthy",
                ]}
                contentStyle={{ borderRadius: "4px", fontSize: "12px" }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                iconSize={10}
                formatter={(value) => {
                  return value === "healthy" ? "Healthy" : "Unhealthy";
                }}
              />
              <Bar
                dataKey="healthy"
                stackId="a"
                fill={colors.green[500]}
                name="healthy"
              />
              <Bar
                dataKey="unhealthy"
                stackId="a"
                fill={colors.red[500]}
                name="unhealthy"
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
