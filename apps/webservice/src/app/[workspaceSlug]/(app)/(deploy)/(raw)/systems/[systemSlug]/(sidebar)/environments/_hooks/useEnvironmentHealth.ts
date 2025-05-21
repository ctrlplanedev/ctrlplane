import type * as SCHEMA from "@ctrlplane/db/schema";

import { api } from "~/trpc/react";

export const useEnvironmentHealth = (
  environment: SCHEMA.Environment,
  enabled: boolean,
) => {
  const releaseTargetsQ = api.releaseTarget.list.useQuery({
    environmentId: environment.id,
    limit: 0,
  });
  const numReleaseTargets = releaseTargetsQ.data?.total ?? 0;

  const unhealthyResourcesQ = api.environment.stats.unhealthyResources.useQuery(
    environment.id,
    { enabled },
  );

  const isHealthSummaryLoading =
    releaseTargetsQ.isLoading || unhealthyResourcesQ.isLoading;
  const unhealthyCount = unhealthyResourcesQ.data?.length ?? 0;
  const totalCount = numReleaseTargets;

  return { isHealthSummaryLoading, unhealthyCount, totalCount };
};
