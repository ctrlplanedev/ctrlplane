"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React, { useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconCheck, IconCopy, IconDots } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { toast } from "@ctrlplane/ui/toast";

import { api } from "~/trpc/react";
import { EnvironmentDropdown } from "./EnvironmentDropdown";

type Environment = RouterOutputs["environment"]["bySystemId"][number];

type EnvironmentHealthProps = { environment: Environment };

const EnvironmentHealth: React.FC<EnvironmentHealthProps> = ({
  environment,
}) => {
  const allResourcesQ = api.resource.byWorkspaceId.list.useQuery(
    {
      workspaceId: environment.system.workspaceId,
      filter: environment.resourceFilter ?? undefined,
      limit: 0,
    },
    { enabled: environment.resourceFilter != null },
  );

  const unhealthyResourcesQ = api.environment.stats.unhealthyResources.useQuery(
    environment.id,
  );

  const unhealthyCount = unhealthyResourcesQ.data?.length ?? 0;
  const totalCount = allResourcesQ.data?.total ?? 0;
  const healthyCount = totalCount - unhealthyCount;

  const isLoading = unhealthyResourcesQ.isLoading || allResourcesQ.isLoading;

  if (isLoading) return <Skeleton className="h-4 w-20 rounded-full" />;

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "h-2 w-2 rounded-full",
          totalCount > 0
            ? unhealthyCount === 0
              ? "bg-green-500"
              : "bg-red-500"
            : "bg-neutral-600",
        )}
      />
      {totalCount > 0
        ? `${healthyCount}/${totalCount} Healthy`
        : "No resources"}
    </div>
  );
};

const LazyEnvironmentHealth: React.FC<EnvironmentHealthProps> = (props) => {
  const { ref, inView } = useInView();
  return (
    <div ref={ref}>
      {!inView && <Skeleton className="h-4 w-20 rounded-full" />}
      {inView && <EnvironmentHealth {...props} />}
    </div>
  );
};

export const EnvironmentCard: React.FC<{
  environment: Environment;
}> = ({ environment }) => {
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
    { enabled: environment.resourceFilter != null },
  );

  const unhealthyResourcesQ = api.environment.stats.unhealthyResources.useQuery(
    environment.id,
  );

  // Mock data for failure rate
  // In a real implementation, fetch this data from an API

  const latestReleaseFailureRate = 3.2; // percentage

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

  return (
    <Link
      href={`/${workspaceSlug}/systems/${systemSlug}/environments/${environment.id}`}
      className="block"
    >
      <Card className="transition-shadow duration-300 hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center space-x-2">
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
            <CardTitle className="text-sm font-medium">
              {environment.name}
            </CardTitle>
          </div>
          <div className="flex items-center">
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
            <span className="text-sm font-medium">
              {totalCount > 0 ? `${totalCount} total` : "None"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted-foreground">Health</span>
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
            <span className="text-sm text-muted-foreground">
              Latest Release
            </span>
            <span className="text-sm font-medium">
              {latestReleaseFailureRate > 5 ? (
                <span className="text-red-400">
                  {latestReleaseFailureRate}% failure rate
                </span>
              ) : (
                <span className="text-green-400">
                  {latestReleaseFailureRate}% failure rate
                </span>
              )}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

export const EnvironmentRow: React.FC<{
  environment: Environment;
}> = ({ environment }) => {
  const { workspaceSlug, systemSlug } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
  }>();

  return (
    <Link
      className="flex items-center border-b p-4 hover:bg-muted/50"
      href={`/${workspaceSlug}/systems/${systemSlug}/environments/${environment.id}`}
    >
      <div className="flex-1">{environment.name}</div>
      <div className="flex-1">
        <LazyEnvironmentHealth environment={environment} />
      </div>
      <div className="flex flex-1 justify-end">
        <EnvironmentDropdown environment={environment}>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <IconDots className="h-4 w-4" />
          </Button>
        </EnvironmentDropdown>
      </div>
    </Link>
  );
};
