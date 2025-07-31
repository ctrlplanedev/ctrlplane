import { api } from "~/trpc/react";

export const useChartData = (deploymentId: string, environmentId: string) => {
  const { data } =
    api.dashboard.widget.data.deploymentVersionDistribution.useQuery(
      { deploymentId, environmentIds: [environmentId] },
      { refetchInterval: 10_000 },
    );

  return data ?? [];
};
