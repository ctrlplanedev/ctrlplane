"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React, { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconCheck, IconCopy, IconDots } from "@tabler/icons-react";
import { subWeeks } from "date-fns";
import { useInView } from "react-intersection-observer";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { toast } from "@ctrlplane/ui/toast";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { EnvironmentDropdown } from "./EnvironmentDropdown";

type Environment = RouterOutputs["environment"]["bySystemId"][number];

export const EnvironmentCard: React.FC<{
  environment: Environment;
}> = ({ environment }) => {
  const { ref, inView } = useInView();

  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  const allResourcesQ = api.resource.byWorkspaceId.list.useQuery(
    {
      workspaceId: environment.system.workspaceId,
      filter: environment.resourceFilter ?? undefined,
      limit: 0,
    },
    { enabled: inView && environment.resourceFilter != null },
  );

  const unhealthyResourcesQ = api.environment.stats.unhealthyResources.useQuery(
    environment.id,
    { enabled: inView },
  );

  const endDate = new Date();
  const startDate = subWeeks(endDate, 1);
  const failureRateQ = api.environment.stats.failureRate.useQuery(
    { environmentId: environment.id, startDate, endDate },
    { enabled: inView },
  );

  const isHealthSummaryLoading =
    allResourcesQ.isLoading || unhealthyResourcesQ.isLoading;
  const unhealthyCount = unhealthyResourcesQ.data?.length ?? 0;
  const totalCount = allResourcesQ.data?.total ?? 0;
  const healthyCount = totalCount - unhealthyCount;
  const status =
    totalCount > 0
      ? unhealthyCount === 0
        ? "Healthy"
        : "Issues Detected"
      : "No Resources";
  const statusColor =
    totalCount > 0 ? (unhealthyCount === 0 ? "green" : "red") : "neutral";

  const environmentUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .environment(environment.id)
    .baseUrl();

  const isLoading = isHealthSummaryLoading || !inView;

  return (
    <Link href={environmentUrl} className="block" ref={ref}>
      <Card className="transition-shadow duration-300 hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center space-x-2">
            {!isLoading && (
              <div
                className={cn(
                  "h-3 w-3 animate-pulse rounded-full",
                  statusColor === "green"
                    ? "bg-green-400"
                    : statusColor === "red"
                      ? "bg-red-400"
                      : "bg-neutral-400",
                )}
              />
            )}
            {isLoading && (
              <div className="h-3 w-3 animate-pulse rounded-full bg-neutral-400" />
            )}
            <CardTitle className="text-sm font-medium">
              {environment.name}
            </CardTitle>
          </div>
          <div className="flex items-center">
            {!isLoading && (
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  statusColor === "green"
                    ? "bg-green-500/20 text-green-400"
                    : statusColor === "red"
                      ? "bg-red-500/20 text-red-400"
                      : "bg-neutral-500/20 text-neutral-400",
                )}
              >
                {status}
              </span>
            )}
            {isLoading && <Skeleton className="h-6 w-16 rounded-full" />}
            <div className="ml-2">
              <EnvironmentDropdown environment={environment}>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <IconDots className="h-4 w-4" />
                </Button>
              </EnvironmentDropdown>
            </div>
          </div>
        </CardHeader>

        <CardContent className="mt-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Resources</span>
            {isLoading && <Skeleton className="h-4 w-16" />}
            {!isLoading && (
              <span className="text-sm font-medium">
                {totalCount > 0 ? `${totalCount} total` : "None"}
              </span>
            )}
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Health</span>
            {isLoading && <Skeleton className="h-4 w-20" />}
            {!isLoading && (
              <span
                className={cn(
                  "text-sm font-medium",
                  statusColor === "green"
                    ? "text-green-400"
                    : statusColor === "red"
                      ? "text-red-400"
                      : "text-neutral-400",
                )}
              >
                {totalCount > 0
                  ? `${healthyCount}/${totalCount} Healthy`
                  : "No resources"}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Environment ID
            </span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">
                {environment.id.substring(0, 8)}...
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-full hover:bg-neutral-800/50"
                onClick={useCallback(
                  (e: React.MouseEvent<HTMLButtonElement>) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(environment.id);
                    toast.success("Environment ID copied to clipboard", {
                      description: environment.id,
                      duration: 2000,
                      icon: <IconCheck className="h-4 w-4" />,
                    });
                  },
                  [environment.id],
                )}
                title="Copy environment ID"
              >
                <IconCopy className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Failure Rate</span>
            {inView && !failureRateQ.isLoading && failureRateQ.data != null && (
              <span
                className={cn(
                  "text-sm font-medium",
                  failureRateQ.data > 5 ? "text-red-400" : "text-green-400",
                )}
              >
                {Number(failureRateQ.data).toFixed(0)}% failure rate
              </span>
            )}
            {(!inView ||
              failureRateQ.isLoading ||
              failureRateQ.data == null) && <Skeleton className="h-4 w-28" />}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};
