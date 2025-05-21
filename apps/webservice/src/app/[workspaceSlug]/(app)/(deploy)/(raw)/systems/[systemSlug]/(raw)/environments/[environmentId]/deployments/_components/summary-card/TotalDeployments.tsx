import _ from "lodash";

import { api } from "~/trpc/react";

export const TotalDeployments: React.FC<{
  environmentId: string;
}> = ({ environmentId }) => {
  const releaseTargetsQ = api.releaseTarget.list.useQuery({
    environmentId,
  });

  const deployments = _.chain(releaseTargetsQ.data?.items ?? [])
    .map((releaseTarget) => releaseTarget.deployment)
    .uniqBy((deployment) => deployment.id)
    .value();

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400">Total Deployments</div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-100">
        {deployments.length}
      </div>
    </div>
  );
};
