"use client";

import { Card, CardContent } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";

type WorkspaceResourcesProps = {
  workspaceId: string;
};

export const WorkspaceResources: React.FC<WorkspaceResourcesProps> = ({
  workspaceId,
}) => {
  const { data, isLoading } = api.resource.byWorkspaceId.list.useQuery({
    workspaceId,
    limit: 0,
  });

  const numResources = data?.total ?? 0;

  return (
    <Card className="shadow-sm">
      <CardContent className="px-6 pt-6">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex flex-col">
            <p className="mb-1 text-sm font-medium text-muted-foreground">
              Total Resources
            </p>
            <p className="text-3xl font-semibold">
              {numResources.toLocaleString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
