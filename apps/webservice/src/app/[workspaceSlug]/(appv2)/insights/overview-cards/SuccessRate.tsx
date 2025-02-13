"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";

type SuccessRateProps = {
  workspaceId: string;
  systemId?: string;
  startDate: Date;
  endDate: Date;
};

export const SuccessRate: React.FC<SuccessRateProps> = ({
  workspaceId,
  systemId,
  startDate,
  endDate,
}) => {
  const { data, isLoading } = api.deployment.stats.totals.useQuery({
    workspaceId,
    systemId,
    startDate,
    endDate,
  });

  const prettySuccessRate = (data?.successRate ?? 0).toFixed(2);

  return (
    <Card className="w-full rounded-md bg-inherit">
      <CardHeader>
        <CardTitle>Success Rate</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-7 w-16" />}
        {!isLoading && (
          <p className="text-xl font-semibold">{prettySuccessRate}%</p>
        )}
      </CardContent>
    </Card>
  );
};
