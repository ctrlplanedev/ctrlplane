"use client";

import React from "react";
import { IconServer } from "@tabler/icons-react";

import { cn } from "@ctrlplane/ui";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@ctrlplane/ui/card";

import { api } from "~/trpc/react";

const getProviderDistro = (providers?: {
  total: number;
  aws: number;
  google: number;
  azure: number;
}) => {
  if (providers == null || providers.total === 0)
    return {
      total: 0,
      aws: { count: 0, percentage: 0 },
      google: { count: 0, percentage: 0 },
      azure: { count: 0, percentage: 0 },
      custom: { count: 0, percentage: 0 },
    };

  const customCount =
    providers.total - providers.aws - providers.google - providers.azure;

  return {
    total: providers.total,
    aws: {
      count: providers.aws,
      percentage: (providers.aws / providers.total) * 100,
    },
    google: {
      count: providers.google,
      percentage: (providers.google / providers.total) * 100,
    },
    azure: {
      count: providers.azure,
      percentage: (providers.azure / providers.total) * 100,
    },
    custom: {
      count: customCount,
      percentage: (customCount / providers.total) * 100,
    },
  };
};

export const ProviderStatisticsCard: React.FC<{
  workspaceId: string;
}> = ({ workspaceId }) => {
  const { data, isLoading } =
    api.resource.provider.page.overview.byWorkspaceId.useQuery(workspaceId);

  const providerDistro = getProviderDistro(data?.providers);
  const popularKinds = data?.resources.popularKinds ?? [];
  return (
    <Card className="col-span-1 flex flex-col bg-neutral-900/50 shadow-md transition duration-200 hover:shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <IconServer className="h-4 w-4 text-blue-400" />
          Provider Statistics
        </div>
        <CardTitle className="text-lg">Overview</CardTitle>
        <CardDescription>Summary of resource providers</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-grow flex-col space-y-6">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-lg border border-neutral-800/50 bg-neutral-800/30 p-3 shadow-inner">
            <div
              className={cn(
                "text-2xl font-semibold",
                (data?.providers.total ?? 0) > 0
                  ? "text-blue-400"
                  : "text-muted-foreground",
              )}
            >
              {isLoading ? "-" : providerDistro.total}
            </div>
            <div className="text-xs text-muted-foreground">Total Providers</div>
          </div>
          <div className="rounded-lg border border-neutral-800/50 bg-neutral-800/30 p-3 shadow-inner">
            <div
              className={cn(
                "text-2xl font-semibold",
                (data?.resources.total ?? 0) > 0
                  ? "text-green-400"
                  : "text-muted-foreground",
              )}
            >
              {isLoading ? "-" : (data?.resources.total ?? 0)}
            </div>
            <div className="text-xs text-muted-foreground">Total Resources</div>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium text-neutral-300">
            Provider Configurations
          </h4>
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-300">AWS</span>
                <span className="text-sm text-muted-foreground">
                  {providerDistro.aws.count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{
                    width: `${providerDistro.aws.percentage}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-300">Google Cloud</span>
                <span className="text-sm text-muted-foreground">
                  {providerDistro.google.count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-red-500"
                  style={{
                    width: `${providerDistro.google.percentage}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-300">Azure</span>
                <span className="text-sm text-muted-foreground">
                  {providerDistro.azure.count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{
                    width: `${providerDistro.azure.percentage}%`,
                  }}
                ></div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-sm text-neutral-300">Custom</span>
                <span className="text-sm text-muted-foreground">
                  {providerDistro.custom.count}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{
                    width: `${providerDistro.custom.percentage}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {popularKinds.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-neutral-300">
              Popular Resource Kinds
            </h4>
            <div className="space-y-1">
              {popularKinds.map(({ version, kind, count }) => (
                <div key={kind} className="flex justify-between">
                  <span className="text-sm text-neutral-300">
                    {kind}:{version}
                  </span>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
