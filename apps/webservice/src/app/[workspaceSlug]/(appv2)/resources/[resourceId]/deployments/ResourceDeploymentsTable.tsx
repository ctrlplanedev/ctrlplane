"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import type { StatsOrder } from "@ctrlplane/validators/deployments";
import type { JobCondition } from "@ctrlplane/validators/jobs";
import { useMemo } from "react";
import { subDays } from "date-fns";
import _ from "lodash";

import { Card } from "@ctrlplane/ui/card";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import {
  ColumnOperator,
  ComparisonOperator,
  DateOperator,
  FilterType,
} from "@ctrlplane/validators/conditions";
import { StatsColumn } from "@ctrlplane/validators/deployments";
import { JobFilterType } from "@ctrlplane/validators/jobs";

import { TableHeadCell } from "~/app/[workspaceSlug]/(appv2)/_components/TableHeadCell";
import { useQueryParams } from "~/app/[workspaceSlug]/(appv2)/_components/useQueryParams";
import { api } from "~/trpc/react";
import { ResourceDeploymentRow } from "./ResourceDeploymentRow";
import { ResourceDeploymentRowSkeleton } from "./ResourceDeploymentRowSkeleton";

type ResourceDeploymentsTableProps = { resource: SCHEMA.Resource };

const getFilter = (
  resourceId: string,
  startDate: Date,
  endDate: Date,
): JobCondition => {
  const resourceFilter: JobCondition = {
    type: JobFilterType.JobResource,
    operator: ColumnOperator.Equals,
    value: resourceId,
  };

  const startDateFilter: JobCondition = {
    type: FilterType.CreatedAt,
    operator: DateOperator.AfterOrOn,
    value: startDate.toISOString(),
  };

  const endDateFilter: JobCondition = {
    type: FilterType.CreatedAt,
    operator: DateOperator.BeforeOrOn,
    value: endDate.toISOString(),
  };

  return {
    type: FilterType.Comparison,
    operator: ComparisonOperator.And,
    conditions: [resourceFilter, startDateFilter, endDateFilter],
  };
};

export const ResourceDeploymentsTable: React.FC<
  ResourceDeploymentsTableProps
> = ({ resource }) => {
  const { workspaceId } = resource;

  const { getParam } = useQueryParams();

  const orderByParam = getParam("order-by");
  const orderParam = getParam("order");

  const endDate = useMemo(() => new Date(), []);
  const startDate = subDays(endDate, 14);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const filter = getFilter(resource.id, startDate, endDate);

  const triggersQ = api.job.config.byWorkspaceId.list.useQuery({
    workspaceId,
    filter,
    limit: 100,
  });

  const triggers = triggersQ.data ?? [];

  const latestTriggersByDeployment = _.chain(triggers)
    .groupBy((t) => t.release.deploymentId)
    .map((groupedTriggers) => _.maxBy(groupedTriggers, (t) => t.job.startedAt))
    .filter((t) => t != null)
    .value();

  const statsQ = api.deployment.stats.byWorkspaceId.useQuery({
    workspaceId,
    resourceId: resource.id,
    startDate,
    endDate,
    timezone,
    orderBy: orderByParam != null ? (orderByParam as StatsColumn) : undefined,
    order: orderParam != null ? (orderParam as StatsOrder) : undefined,
  });

  const stats = statsQ.data ?? [];

  const statsWithLatestTrigger = stats.map((stat) => {
    const latestTrigger = latestTriggersByDeployment.find(
      (t) => t.release.deploymentId === stat.id,
    );
    return { ...stat, latestTrigger, resource };
  });

  const isLoading = triggersQ.isLoading || statsQ.isLoading;

  return (
    <Card className="rounded-md">
      <Table>
        <TableHeader>
          <TableRow className="h-16 hover:bg-transparent">
            <TableHead className="p-4">
              <TableHeadCell title="Deployment" orderByKey={StatsColumn.Name} />
            </TableHead>

            <TableHead className="w-20 p-4 xl:w-40">Version</TableHead>

            <TableHead className="p-4">History</TableHead>

            <TableHead className="p-4">
              <TableHeadCell
                title="P50 Duration"
                orderByKey={StatsColumn.P50}
              />
            </TableHead>

            <TableHead className="p-4">
              <TableHeadCell
                title="P90 Duration"
                orderByKey={StatsColumn.P90}
              />
            </TableHead>

            <TableHead className="p-4">
              <TableHeadCell
                title="Success Rate"
                orderByKey={StatsColumn.SuccessRate}
              />
            </TableHead>

            <TableHead className="hidden p-4 xl:table-cell xl:w-[120px]">
              <TableHeadCell
                title="Last Run"
                orderByKey={StatsColumn.LastRunAt}
              />
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {!isLoading &&
            statsWithLatestTrigger.map((stat) => (
              <ResourceDeploymentRow key={stat.id} stats={stat} />
            ))}
          {isLoading &&
            Array.from({ length: 3 }).map((_, index) => (
              <ResourceDeploymentRowSkeleton key={index} index={index} />
            ))}
        </TableBody>
      </Table>
    </Card>
  );
};
