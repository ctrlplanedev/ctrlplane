"use client";

import { api } from "~/trpc/react";

type AggregateStatsProps = {
  workspaceId: string;
  startDate: Date;
  endDate: Date;
};

export const AggregateStats: React.FC<AggregateStatsProps> = ({
  workspaceId,
  startDate,
  endDate,
}) => {
  const { data, isLoading } = api.deployment.stats.totals.useQuery({
    workspaceId,
    startDate,
    endDate,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="flex flex-col gap-2">
      <span>Total Jobs: {data?.totalJobs}</span>
      <span>Total Duration: {data?.totalDuration}</span>
      <span>Success Rate: {data?.successRate}</span>
    </div>
  );
};
