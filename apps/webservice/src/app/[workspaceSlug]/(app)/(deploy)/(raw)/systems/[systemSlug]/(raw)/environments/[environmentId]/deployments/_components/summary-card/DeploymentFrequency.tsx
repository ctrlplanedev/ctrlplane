import React from "react";

import { api } from "~/trpc/react";
import { PercentChange } from "./PercentChange";

export const DeploymentFrequency: React.FC<{
  environmentId: string;
  workspaceId: string;
}> = ({ environmentId, workspaceId }) => {
  const totalDeploymentsQ = api.environment.page.deployments.total.useQuery({
    environmentId,
    workspaceId,
  });

  const { deploymentsInCurrentPeriod, deploymentsInPreviousPeriod } =
    totalDeploymentsQ.data ?? {
      deploymentsInCurrentPeriod: 0,
      deploymentsInPreviousPeriod: 0,
    };

  const frequencyInCurrentPeriod = deploymentsInCurrentPeriod / 30;
  const frequencyInPreviousPeriod = deploymentsInPreviousPeriod / 30;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400">Deployment Frequency</div>
        <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
          Last 30 days
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-100">
        {frequencyInCurrentPeriod.toFixed(1)}/day
      </div>
      <PercentChange
        current={frequencyInCurrentPeriod}
        previous={frequencyInPreviousPeriod}
      />
    </div>
  );
};
