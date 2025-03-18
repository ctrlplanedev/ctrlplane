"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@ctrlplane/ui/card";
import { Skeleton } from "@ctrlplane/ui/skeleton";

import { api } from "~/trpc/react";

type SuccessRateProps = {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
};

export const SuccessRate: React.FC<SuccessRateProps> = ({
  workspaceId,
  startDate,
  endDate,
}) => {
  const { data, isLoading } = api.deployment.stats.totals.useQuery({
    startDate,
    endDate,
    workspaceId,
  });

  const prettySuccessRate = (data?.successRate ?? 0).toFixed(2);

  return (
    <Card className="shadow-sm">
      <CardContent className="px-6 pt-6">
        {isLoading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="flex flex-col">
            <p className="mb-1 text-sm font-medium text-muted-foreground">
              Success Rate
            </p>
            <p
              className={`text-3xl font-semibold ${Number(prettySuccessRate) >= 90 ? "text-green-600" : Number(prettySuccessRate) >= 70 ? "text-yellow-600" : "text-red-600"}`}
            >
              {prettySuccessRate}%
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
