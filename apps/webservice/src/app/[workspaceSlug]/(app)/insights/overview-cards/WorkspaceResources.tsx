"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
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
    <Card className="w-full rounded-md bg-inherit">
      <CardHeader>
        <CardTitle>Total Resources</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-7 w-16" />}
        {!isLoading && <p className="text-xl font-semibold">{numResources}</p>}
      </CardContent>
    </Card>
  );
};
