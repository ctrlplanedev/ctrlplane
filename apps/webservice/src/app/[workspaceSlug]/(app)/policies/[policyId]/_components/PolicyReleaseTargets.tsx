import _ from "lodash";

import { api } from "~/trpc/react";

export const PolicyReleaseTargets: React.FC<{
  policyId: string;
}> = ({ policyId }) => {
  const { data } = api.policy.releaseTargets.useQuery(policyId, {
    refetchInterval: 60_000,
  });

  const releaseTargets = data?.releaseTargets ?? [];
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Release Targets</h2>
        <p className="text-sm text-muted-foreground">
          {data?.count} release targets
        </p>
      </div>

      {_(releaseTargets)
        .groupBy((r) => r.system.id)
        .map((rts, systemId) => (
          <div key={systemId}>
            <h3 className="text-lg font-medium">{rts[0]!.system.name}</h3>
            <div className="flex flex-col gap-2">
              {rts.map((rt) => (
                <div key={rt.id}>
                  <p>{rt.deployment.name}</p>
                  <p>{rt.environment.name}</p>
                  <p>{rt.resource.name}</p>
                </div>
              ))}
            </div>
          </div>
        ))
        .value()}
    </div>
  );
};
