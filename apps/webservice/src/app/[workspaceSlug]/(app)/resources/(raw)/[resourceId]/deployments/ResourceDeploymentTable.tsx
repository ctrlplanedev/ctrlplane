"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { StatsOrder } from "@ctrlplane/validators/deployments";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { subDays } from "date-fns";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { StatsColumn } from "@ctrlplane/validators/deployments";

import { TableSortHeader } from "~/app/[workspaceSlug]/(app)/_components/TableSortHeader";
import { api } from "~/trpc/react";
import { ResourceDeploymentRow } from "./ResourceDeploymentRow";
import { ResourceDeploymentRowSkeleton } from "./ResourceDeploymentRowSkeleton";

type ResourceDeploymentsTableProps = { resource: SCHEMA.Resource };

export const ResourceDeploymentsTable: React.FC<
  ResourceDeploymentsTableProps
> = ({ resource }) => {
  const { workspaceId } = resource;

  const params = useSearchParams();
  const orderByParam = params.get("order-by");
  const orderParam = params.get("order");

  const endDate = useMemo(() => new Date(), []);
  const startDate = subDays(endDate, 14);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const { data, isLoading } = api.deployment.stats.byWorkspaceId.useQuery({
    resourceId: resource.id,
    startDate,
    endDate,
    timezone,
    orderBy: (orderByParam as StatsColumn | null) ?? undefined,
    order: (orderParam as StatsOrder | null) ?? undefined,
  });

  return (
    <Table>
      <TableHeader>
        <TableRow className="h-16 hover:bg-transparent">
          <TableHead className="p-4">
            <TableSortHeader orderByKey={StatsColumn.Name}>
              Deployment
            </TableSortHeader>
          </TableHead>

          <TableHead className="w-20 p-4 xl:w-40">Version</TableHead>
          <TableHead className="w-20 p-4 xl:w-40">Status</TableHead>

          <TableHead className="p-4">History</TableHead>

          <TableHead className="p-4">
            <TableSortHeader orderByKey={StatsColumn.P50}>
              P50 Duration
            </TableSortHeader>
          </TableHead>

          <TableHead className="p-4">
            <TableSortHeader orderByKey={StatsColumn.P90}>
              P90 Duration
            </TableSortHeader>
          </TableHead>

          <TableHead className="p-4">
            <TableSortHeader orderByKey={StatsColumn.SuccessRate}>
              Success Rate
            </TableSortHeader>
          </TableHead>

          <TableHead className="hidden p-4 xl:table-cell xl:w-[120px]">
            <TableSortHeader orderByKey={StatsColumn.LastRunAt}>
              Last Run
            </TableSortHeader>
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {!isLoading &&
          data?.map((stat) => (
            <ResourceDeploymentRow
              key={stat.id}
              stats={stat}
              workspaceId={workspaceId}
            />
          ))}
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <ResourceDeploymentRowSkeleton
              key={index}
              opacity={1 * (1 - index / 3)}
            />
          ))}
      </TableBody>
    </Table>
  );
};
