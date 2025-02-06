"use client";

import type {
  StatsColumn,
  StatsOrder,
} from "@ctrlplane/validators/deployments";
import { useMemo, useState } from "react";
import { IconSearch } from "@tabler/icons-react";
import { startOfMonth, subDays, subMonths, subWeeks } from "date-fns";
import { useDebounce } from "react-use";

import { Card } from "@ctrlplane/ui/card";
import { Input } from "@ctrlplane/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@ctrlplane/ui/tabs";

import { api } from "~/trpc/react";
import { useQueryParams } from "../_components/useQueryParams";
import { AggregateCharts } from "./AggregateCharts";
import { DeploymentTable } from "./deployment-table/DeploymentTable";

const getStartDate = (timePeriod: string, today: Date) => {
  if (timePeriod === "mtd") return startOfMonth(today);
  if (timePeriod === "7d") return subWeeks(today, 1);
  if (timePeriod === "14d") return subWeeks(today, 2);
  if (timePeriod === "30d") return subDays(today, 29);
  if (timePeriod === "3m") return subMonths(today, 2);
  return today;
};

export const DeploymentsCard: React.FC<{ workspaceId: string }> = ({
  workspaceId,
}) => {
  const { getParam } = useQueryParams();

  const orderByParam = getParam("order-by");
  const orderParam = getParam("order");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [timePeriod, setTimePeriod] = useState("14d");

  useDebounce(() => setDebouncedSearch(search), 500, [search]);

  const today = useMemo(() => new Date(), []);
  const startDate = getStartDate(timePeriod, today);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const { data, isLoading } = api.deployment.stats.byWorkspaceId.useQuery(
    {
      workspaceId,
      startDate,
      endDate: today,
      timezone,
      orderBy: orderByParam != null ? (orderByParam as StatsColumn) : undefined,
      order: orderParam != null ? (orderParam as StatsOrder) : undefined,
      search: debouncedSearch,
    },
    { placeholderData: (prev) => prev, refetchInterval: 60_000 },
  );

  return (
    <div className="container m-8 mx-auto">
      <div className="mb-8 flex justify-between">
        <h2 className="text-3xl font-semibold">Deployments</h2>
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
      <div className="flex flex-col gap-12">
        <AggregateCharts data={data} isLoading={isLoading} />
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
