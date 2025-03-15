"use client";

import type {
  StatsColumn,
  StatsOrder,
} from "@ctrlplane/validators/deployments";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { endOfDay, startOfMonth, subDays, subMonths, subWeeks } from "date-fns";

import { Input } from "@ctrlplane/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { api } from "~/trpc/react";
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
  workspaceId?: string;
  systemId?: string;
  environmentId?: string;
}> = ({ workspaceId, systemId, environmentId }) => {
  const [timePeriod, setTimePeriod] = useState("14d");

  const params = useSearchParams();
  const orderByParam = params.get("order-by");
  const orderParam = params.get("order");

  const [search, setSearch] = useState("");

  const today = useMemo(() => endOfDay(new Date()), []);
  const startDate = getStartDate(timePeriod, today);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, isLoading } = api.deployment.stats.byWorkspaceId.useQuery(
    {
      startDate,
      endDate: today,
      timezone,
      orderBy: (orderByParam as StatsColumn | null) ?? undefined,
      order: (orderParam as StatsOrder | null) ?? undefined,
      search,
      ...(environmentId != null
        ? { environmentId }
        : systemId != null
          ? { systemId }
          : { workspaceId: workspaceId ?? "" }),
    },
    {
      placeholderData: (prev) => prev,
      refetchInterval: 60_000,
      enabled: workspaceId != null || systemId != null || environmentId != null,
    },
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-b p-2">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-80 pl-8"
          />
        </div>
        <Tabs value={timePeriod} onValueChange={setTimePeriod}>
          <TabsList>
            <TabsTrigger value="mtd">MTD</TabsTrigger>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="14d">14D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
            <TabsTrigger value="3m">3M</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="relative w-full overflow-auto">
        <DeploymentTable data={data} isLoading={isLoading} />
      </div>
    </div>
  );
};
