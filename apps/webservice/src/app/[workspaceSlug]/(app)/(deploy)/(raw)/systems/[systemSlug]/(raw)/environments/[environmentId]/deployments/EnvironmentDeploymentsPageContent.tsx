"use client";

import type { JobCondition } from "@ctrlplane/validators/jobs";
import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import LZString from "lz-string";
import prettyMilliseconds from "pretty-ms";
import { useDebounce } from "react-use";

import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import { JobConditionType } from "@ctrlplane/validators/jobs";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import {
  AverageDuration,
  DeploymentFrequency,
  DeploymentSkeletonRow,
  DeploymentTableHeader,
  SearchAndFilters,
  StatusBadge,
  SuccessRate,
  TotalDeployments,
} from "./_components/index";

type Version = {
  id: string;
  tag: string;
};

type DeploymentStat = {
  deployment: { id: string; name: string; slug: string; version: Version };
  status: "pending" | "failed" | "deploying" | "success";
  resourceCount: number;
  duration: number;
  deployedBy: string | null;
  successRate: number;
  deployedAt: Date;
};

const DeploymentRow: React.FC<{
  deploymentStat: DeploymentStat;
}> = ({ deploymentStat }) => {
  const { workspaceSlug, systemSlug, environmentId } = useParams<{
    workspaceSlug: string;
    systemSlug: string;
    environmentId: string;
  }>();
  const router = useRouter();

  const environmentCondition: JobCondition = {
    type: JobConditionType.Environment,
    value: environmentId,
    operator: ColumnOperator.Equals,
  };

  const conditionHash = LZString.compressToEncodedURIComponent(
    JSON.stringify(environmentCondition),
  );

  const deploymentVersionJobsUrl = urls
    .workspace(workspaceSlug)
    .system(systemSlug)
    .deployment(deploymentStat.deployment.slug)
    .release(deploymentStat.deployment.version.id)
    .jobs();

  const urlWithSelector = `${deploymentVersionJobsUrl}?selector=${conditionHash}`;

  return (
    <TableRow
      key={deploymentStat.deployment.id}
      className="h-12 cursor-pointer border-b border-neutral-800/50 hover:bg-neutral-800/20"
      onClick={() => router.push(urlWithSelector)}
    >
      <TableCell className="truncate py-3 font-medium text-neutral-200">
        {deploymentStat.deployment.name}
      </TableCell>
      <TableCell className="truncate py-3 text-neutral-300">
        {deploymentStat.deployment.version.tag}
      </TableCell>
      <TableCell className="py-3">
        <StatusBadge status={deploymentStat.status} />
      </TableCell>
      <TableCell className="py-3 text-neutral-300">
        {deploymentStat.resourceCount}
      </TableCell>

      <TableCell className="truncate py-3 text-neutral-300">
        {prettyMilliseconds(deploymentStat.duration, { compact: true })}
      </TableCell>
      <TableCell className="truncate py-3">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-16 rounded-full bg-neutral-800">
            <div
              className={`h-full rounded-full ${
                deploymentStat.successRate * 100 > 90
                  ? "bg-green-500"
                  : deploymentStat.successRate * 100 > 70
                    ? "bg-amber-500"
                    : "bg-red-500"
              }`}
              style={{ width: `${Number(deploymentStat.successRate * 100)}%` }}
            />
          </div>
          <span className="text-sm">
            {Number(deploymentStat.successRate * 100).toFixed(1)}%
          </span>
        </div>
      </TableCell>
      <TableCell className="truncate py-3 text-neutral-300">
        {deploymentStat.deployedBy}
      </TableCell>
      <TableCell className="truncate py-3 text-sm text-neutral-400">
        {formatDistanceToNow(deploymentStat.deployedAt, {
          addSuffix: true,
        })}
      </TableCell>
    </TableRow>
  );
};

type StatusFilter = "pending" | "failed" | "deploying" | "success" | "all";

export const EnvironmentDeploymentsPageContent: React.FC<{
  environmentId: string;
  workspaceId: string;
}> = ({ environmentId, workspaceId }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [orderBy, setOrderBy] = useState<
    "recent" | "oldest" | "duration" | "success"
  >("recent");
  useDebounce(() => setDebouncedSearch(search), 500, [search]);

  const status = statusFilter === "all" ? undefined : statusFilter;
  const deploymentStatsQ = api.environment.page.deployments.list.useQuery(
    { environmentId, workspaceId, search: debouncedSearch, status, orderBy },
    { placeholderData: (prev) => prev },
  );

  const deploymentStats = deploymentStatsQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Deployment Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <TotalDeployments environmentId={environmentId} />

        <SuccessRate environmentId={environmentId} />

        <AverageDuration environmentId={environmentId} />

        <DeploymentFrequency environmentId={environmentId} />
      </div>

      {/* Search and Filters */}
      <SearchAndFilters
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        orderBy={orderBy}
        onOrderByChange={setOrderBy}
      />

      <div className="rounded-md border border-neutral-800">
        <Table>
          <DeploymentTableHeader />
          <TableBody>
            {deploymentStatsQ.isLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <DeploymentSkeletonRow key={index} />
              ))}
            {deploymentStats.map((deploymentStat) => (
              <DeploymentRow
                key={deploymentStat.deployment.id}
                deploymentStat={deploymentStat}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
