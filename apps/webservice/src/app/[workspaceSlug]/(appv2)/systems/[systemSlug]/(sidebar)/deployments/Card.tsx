"use client";

import type {
  StatsColumn,
  StatsOrder,
} from "@ctrlplane/validators/deployments";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { endOfDay, startOfMonth, subDays, subMonths, subWeeks } from "date-fns";

import { Card } from "@ctrlplane/ui/card";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { AggregateStats } from "./AggragateStats";
import { DailyJobsChart } from "./DailyJobsChart";
import { DeploymentTable } from "./deployment-table/DeploymentTable";

const getStartDate = (timePeriod: string, today: Date) => {
  if (timePeriod === "mtd") return startOfMonth(today);
  if (timePeriod === "7d") return subWeeks(today, 1);
  if (timePeriod === "14d") return subWeeks(today, 2);
  if (timePeriod === "30d") return subDays(today, 29);
  if (timePeriod === "3m") return subMonths(today, 2);
  return today;
};

export const DeploymentsCard: React.FC<{
  workspaceId: string;
  systemId?: string;
  timePeriod?: string;
}> = ({ workspaceId, systemId, timePeriod = "14d" }) => {
  const params = useSearchParams();
  const orderByParam = params.get("order-by");
  const orderParam = params.get("order");

  const [search, setSearch] = useState("");

  const today = useMemo(() => endOfDay(new Date()), []);
  const startDate = getStartDate(timePeriod, today);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, isLoading } = api.deployment.stats.byWorkspaceId.useQuery(
    {
      workspaceId,
      systemId,
      startDate,
      endDate: today,
      timezone,
      orderBy: orderByParam != null ? (orderByParam as StatsColumn) : undefined,
      order: orderParam != null ? (orderParam as StatsOrder) : undefined,
      search,
    },
    { placeholderData: (prev) => prev, refetchInterval: 60_000 },
  );

  return (
    <div className="container m-8 mx-auto">
      <div className="flex flex-col gap-12">
        <AggregateStats
          workspaceId={workspaceId}
          startDate={startDate}
          endDate={today}
        />

        <div className="h-[400px] w-full rounded-md border p-8">
          <DailyJobsChart
            workspaceId={workspaceId}
            startDate={startDate}
            endDate={today}
          />
        </div>
        <div className="space-y-2">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-80 pl-8"
            />
          </div>

          <Card className="rounded-md">
            <div>
              <div className="relative w-full overflow-auto">
                <DeploymentTable data={data} isLoading={isLoading} />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
