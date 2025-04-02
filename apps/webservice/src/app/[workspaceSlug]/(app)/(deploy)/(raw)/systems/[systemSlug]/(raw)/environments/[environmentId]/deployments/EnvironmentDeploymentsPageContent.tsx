"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { IconSearch } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import LZString from "lz-string";
import prettyMilliseconds from "pretty-ms";
import { useDebounce } from "react-use";

import { Input } from "@ctrlplane/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ctrlplane/ui/select";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";
import { ColumnOperator } from "@ctrlplane/validators/conditions";
import { JobCondition, JobConditionType } from "@ctrlplane/validators/jobs";

import { urls } from "~/app/urls";
import { api } from "~/trpc/react";
import { StatusBadge } from "./_components/StatusBadge";
import { AverageDuration } from "./_components/summary-card/AverageDuration";
import { DeploymentFrequency } from "./_components/summary-card/DeploymentFrequency";
import { SuccessRate } from "./_components/summary-card/SuccessRate";
import { TotalDeployments } from "./_components/summary-card/TotalDeployments";

const SkeletonRow: React.FC = () => (
  <TableRow className="h-12">
    {Array.from({ length: 8 }).map((_, index) => (
      <TableCell key={index}>
        <Skeleton className="h-4 w-20" />
      </TableCell>
    ))}
  </TableRow>
);

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
        <TotalDeployments
          environmentId={environmentId}
          workspaceId={workspaceId}
        />

        <SuccessRate environmentId={environmentId} workspaceId={workspaceId} />

        <AverageDuration
          environmentId={environmentId}
          workspaceId={workspaceId}
        />

        <DeploymentFrequency
          environmentId={environmentId}
          workspaceId={workspaceId}
        />
      </div>

      {/* Search and Filters */}
      <div className="mb-4 flex flex-col justify-between gap-4 md:flex-row">
        <div className="relative">
          <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deployments..."
            className="w-full pl-8 md:w-80"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(status: StatusFilter) => setStatusFilter(status)}
            defaultValue="all"
          >
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="deploying">Deploying</SelectItem>
              <SelectItem value="success">Successful</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={orderBy}
            onValueChange={(
              orderBy: "recent" | "oldest" | "duration" | "success",
            ) => setOrderBy(orderBy)}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select Order By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="duration">Duration (longest)</SelectItem>
              <SelectItem value="success">Success Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-neutral-800">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="border-b border-neutral-800 hover:bg-transparent">
              <TableHead className="w-1/5 font-medium text-neutral-400">
                Component
              </TableHead>
              <TableHead className="w-1/6 font-medium text-neutral-400">
                Version
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Status
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Resources
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Duration
              </TableHead>
              <TableHead className="w-1/8 font-medium text-neutral-400">
                Success Rate
              </TableHead>
              <TableHead className="w-1/8 truncate font-medium text-neutral-400">
                Deployed By
              </TableHead>
              <TableHead className="w-1/12 font-medium text-neutral-400">
                Timestamp
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deploymentStatsQ.isLoading &&
              Array.from({ length: 3 }).map((_, index) => (
                <SkeletonRow key={index} />
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
