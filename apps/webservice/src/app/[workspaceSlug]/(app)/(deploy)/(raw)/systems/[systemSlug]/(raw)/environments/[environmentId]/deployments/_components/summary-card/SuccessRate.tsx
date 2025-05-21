import { cn } from "@ctrlplane/ui";

import { api } from "~/trpc/react";
import { PercentChange } from "./PercentChange";

export const SuccessRate: React.FC<{
  environmentId: string;
}> = ({ environmentId }) => {
  const successRateQ =
    api.environment.page.deployments.aggregateStats.useQuery(environmentId);

  const { statsInCurrentPeriod, statsInPreviousPeriod } = successRateQ.data ?? {
    statsInCurrentPeriod: { successRate: 0 },
    statsInPreviousPeriod: { successRate: 0 },
  };

  const { successRate: successRateInCurrentPeriod } = statsInCurrentPeriod;
  const { successRate: successRateInPreviousPeriod } = statsInPreviousPeriod;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400">Success Rate</div>
        <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
          Last 30 days
        </div>
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-semibold",
          successRateInCurrentPeriod > 90 && "text-green-400",
          successRateInCurrentPeriod > 50 &&
            successRateInCurrentPeriod <= 90 &&
            "text-yellow-400",
          successRateInCurrentPeriod <= 50 && "text-red-400",
        )}
      >
        {Number(successRateInCurrentPeriod).toFixed(1)}%
      </div>
      <div>
        <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-800">
          <div
            className={cn(
              "h-full rounded-full",
              successRateInCurrentPeriod > 90 && "bg-green-500",
              successRateInCurrentPeriod > 50 &&
                successRateInCurrentPeriod <= 90 &&
                "bg-yellow-500",
              successRateInCurrentPeriod <= 50 && "bg-red-500",
            )}
            style={{ width: `${successRateInCurrentPeriod}%` }}
          />
        </div>
        <PercentChange
          current={successRateInCurrentPeriod}
          previous={successRateInPreviousPeriod}
        />
      </div>
    </div>
  );
};
