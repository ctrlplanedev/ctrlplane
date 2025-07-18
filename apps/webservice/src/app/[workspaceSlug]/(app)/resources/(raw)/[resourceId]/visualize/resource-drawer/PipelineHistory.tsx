import { api } from "~/trpc/react";
import { ReleaseHistoryTable } from "../../deployments/_components/ReleaseHistoryTable";

export const PipelineHistory: React.FC<{ resourceId: string }> = ({
  resourceId,
}) => {
  const { data: releaseTargetsResult } = api.releaseTarget.list.useQuery({
    resourceId,
  });
  const releaseTargets = releaseTargetsResult?.items ?? [];
  const deployments = releaseTargets.map((rt) => rt.deployment);

  return (
    <div className="w-full space-y-4 p-6">
      <div className="text-2xl font-semibold">Pipeline History</div>
      <ReleaseHistoryTable
        resourceId={resourceId}
        deployments={deployments}
        condensed
      />
    </div>
  );
};
