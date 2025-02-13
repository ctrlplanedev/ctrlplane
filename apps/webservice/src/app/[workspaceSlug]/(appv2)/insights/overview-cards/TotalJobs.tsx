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
    <Card className="w-full rounded-md bg-inherit">
      <CardHeader>
        <CardTitle>Total Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-7 w-16" />}
        {!isLoading && (
          <p className="text-xl font-semibold">{data?.totalJobs ?? 0}</p>
        )}
      </CardContent>
    </Card>
  );
};
