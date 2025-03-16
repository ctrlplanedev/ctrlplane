"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";

type TotalJobsProps = {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
};

export const TotalJobs: React.FC<TotalJobsProps> = ({
  workspaceId,
  startDate,
  endDate,
}) => {
  const { data, isLoading } = api.deployment.stats.totals.useQuery({
    workspaceId,
    startDate,
    endDate,
  });

  return (
    <Card className="shadow-sm">
      <CardContent className="pt-6 px-6">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex flex-col">
            <p className="text-sm font-medium text-muted-foreground mb-1">Total Jobs</p>
            <p className="text-3xl font-semibold">{(data?.totalJobs ?? 0).toLocaleString()}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
