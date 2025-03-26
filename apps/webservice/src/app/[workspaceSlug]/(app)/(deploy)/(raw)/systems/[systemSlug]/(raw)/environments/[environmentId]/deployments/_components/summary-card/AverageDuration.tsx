import prettyMilliseconds from "pretty-ms";

import { cn } from "@ctrlplane/ui";

import { api } from "~/trpc/react";

const getPercentChange = (current: number, previous: number) => {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
};

export const PercentChange: React.FC<{
  current: number;
  previous: number;
}> = ({ current, previous }) => {
  const percentChange = getPercentChange(current, previous);
  return (
    <div
      className={cn(
        "mt-1 flex items-center text-xs",
        percentChange === 0 && "text-neutral-400",
        percentChange < 0 && "text-green-400",
        percentChange > 0 && "text-red-400",
      )}
    >
      <span>
        {percentChange > 0 && "↑"}
        {percentChange < 0 && "↓"} {Number(percentChange).toFixed(0)}% from
        previous period
      </span>
    </div>
  );
};

export const AverageDuration: React.FC<{
  environmentId: string;
  workspaceId: string;
}> = ({ environmentId, workspaceId }) => {
  const averageDurationQ =
    api.environment.page.deployments.aggregateStats.useQuery({
      environmentId,
      workspaceId,
    });

  const { statsInCurrentPeriod, statsInPreviousPeriod } =
    averageDurationQ.data ?? {
      statsInCurrentPeriod: { averageDuration: 0 },
      statsInPreviousPeriod: { averageDuration: 0 },
    };

  const { averageDuration: averageDurationInCurrentPeriod } =
    statsInCurrentPeriod;
  const { averageDuration: averageDurationInPreviousPeriod } =
    statsInPreviousPeriod;

  console.log({
    averageDurationInCurrentPeriod,
    averageDurationInPreviousPeriod,
  });

  const averageDurationInCurrentPeriodMs =
    averageDurationInCurrentPeriod * 1000;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-neutral-400">Avg. Duration</div>
        <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
          Last 30 days
        </div>
      </div>
      <div className="mt-2 text-2xl font-semibold text-neutral-100">
        {prettyMilliseconds(averageDurationInCurrentPeriodMs, {
          secondsDecimalDigits: 0,
        })}
        {/* 0ms */}
      </div>
      <PercentChange
        current={averageDurationInCurrentPeriod}
        previous={averageDurationInPreviousPeriod}
      />
    </div>
  );
};
