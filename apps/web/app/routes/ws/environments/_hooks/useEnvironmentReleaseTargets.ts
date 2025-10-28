import _ from "lodash";

import { trpc } from "~/api/trpc";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { useEnvironment } from "../_components/EnvironmentProvider";

const useEnvironmentReleaseTargets = () => {
  const { workspace } = useWorkspace();
  const { environment } = useEnvironment();

  const releaseTargetsQuery = trpc.environment.releaseTargets.useQuery(
    {
      workspaceId: workspace.id,
      environmentId: environment.id,
      limit: 1000,
    },
    { refetchInterval: 30_000 },
  );

  const releaseTargets = releaseTargetsQuery.data?.items ?? [];
  return { releaseTargets, isLoading: releaseTargetsQuery.isLoading };
};

export const useTargetsGroupedByDeployment = () => {
  const { releaseTargets, isLoading } = useEnvironmentReleaseTargets();
  const groupedByDeployment = _.chain(releaseTargets)
    .groupBy((rt) => rt.deployment.id)
    .map((releaseTargets) => {
      const { deployment } = releaseTargets[0];
      return { deployment, releaseTargets };
    })
    .value();
  return { groupedByDeployment, isLoading };
};
