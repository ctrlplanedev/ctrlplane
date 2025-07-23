import type * as schema from "@ctrlplane/db/schema";

import { api } from "~/trpc/react";
import { ReleaseHistoryTable } from "../../deployments/_components/ReleaseHistoryTable";

export const PipelineHistory: React.FC<{ resource: schema.Resource }> = ({
  resource,
}) => {
  const { data: releaseTargetsResult } = api.releaseTarget.list.useQuery({
    resourceId: resource.id,
  });
  const releaseTargets = releaseTargetsResult?.items ?? [];
  const deployments = releaseTargets.map((rt) => rt.deployment);

  return (
    <div className="w-full space-y-4 p-6">
      <div className="text-2xl font-semibold">Pipeline History</div>
      <ReleaseHistoryTable
        resource={resource}
        deployments={deployments}
        condensed
      />
    </div>
  );
};
