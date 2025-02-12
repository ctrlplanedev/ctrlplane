"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconDots } from "@tabler/icons-react";
import { useInView } from "react-intersection-observer";

import { cn } from "@ctrlplane/ui";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";

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
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <IconDots className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Add Resources</DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link
                href={`/${workspaceSlug}/systems/${systemSlug}/environments/${environment.id}`}
              >
                Edit
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </Link>
  );
};
