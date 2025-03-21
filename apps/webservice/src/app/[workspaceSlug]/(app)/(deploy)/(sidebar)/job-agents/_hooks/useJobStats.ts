import { useMemo } from "react";
import { isSameDay, subMonths } from "date-fns";

import { api } from "~/trpc/react";
import { dateRange } from "~/utils/date/range";

export const useJobStats = (jobAgentId: string) => {
  const { data: stats, isLoading: isStatsLoading } =
    api.job.agent.stats.byId.useQuery(jobAgentId);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const endDate = useMemo(() => new Date(), []);
  const startDate = subMonths(endDate, 1);

  const { data: history, isLoading: isHistoryLoading } =
    api.job.agent.history.byId.useQuery({
      jobAgentId,
      timezone,
      startDate,
      endDate,
    });

  const range = dateRange(startDate, endDate, 1, "days");
  const fullHistory = range.map((date) => {
    const historyItem = history?.find((h) => isSameDay(h.date, date));
    return {
      date,
      count: historyItem?.count ?? 0,
    };
  });

  return {
    stats: {
      deployments: stats?.deployments ?? 0,
      lastActive: stats?.lastActive,
      jobs: stats?.jobs ?? 0,
    },
    isStatsLoading,
    history: fullHistory,
    isHistoryLoading: isHistoryLoading,
  };
};
