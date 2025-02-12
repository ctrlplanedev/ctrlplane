"use client";

import type { RouterOutputs } from "@ctrlplane/api";
import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { IconDots } from "@tabler/icons-react";

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

export const EnvironmentRow: React.FC<{
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

  const unhealthyCount = unhealthyResourcesQ.data?.length ?? 0;
  const totalCount = allResourcesQ.data?.total ?? 0;
  const healthyCount = totalCount - unhealthyCount;

  const isLoading = unhealthyResourcesQ.isLoading || allResourcesQ.isLoading;

  return (
    <div className="flex items-center border-b p-4">
      <div className="flex-1">{environment.name}</div>
      <div className="flex-1">
        {isLoading && <Skeleton className="h-4 w-20 rounded-full" />}
        {!isLoading && (
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                totalCount > 0
                  ? unhealthyCount === 0
                    ? "bg-green-500"
                    : "bg-destructive"
                  : "bg-muted",
              )}
            />
            {totalCount > 0
              ? `${healthyCount}/${totalCount} Healthy`
              : "No resources"}
          </div>
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm text-muted-foreground">Latest: v1.0.0</div>
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
    </div>
  );
};
