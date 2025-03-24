"use client";

import React, { useState } from "react";
import { IconFilter, IconSearch } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import prettyMilliseconds from "pretty-ms";
import { useDebounce } from "react-use";

import { Badge } from "@ctrlplane/ui/badge";
import { Input } from "@ctrlplane/ui/input";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";
import { StatusBadge } from "./_components/StatusBadge";

const SkeletonRow: React.FC = () => (
  <TableRow className="h-12">
    {Array.from({ length: 8 }).map((_, index) => (
      <TableCell key={index}>
        <Skeleton className="h-4 w-20" />
      </TableCell>
    ))}
  </TableRow>
);

export const EnvironmentDeploymentsPageContent: React.FC<{
  environmentId: string;
  workspaceId: string;
}> = ({ environmentId, workspaceId }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useDebounce(() => setDebouncedSearch(search), 500, [search]);

  const deploymentStatsQ = api.environment.page.deployments.list.useQuery(
    {
      environmentId,
      workspaceId,
      search: debouncedSearch,
    },
    { placeholderData: (prev) => prev },
  );

  const deploymentStats = deploymentStatsQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Deployment Summary Cards */}
      {/* <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Total Deployments</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-neutral-100">42</div>
          <div className="mt-1 flex items-center text-xs text-green-400">
            <span>↑ 8% from previous period</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Success Rate</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-green-400">
            89.7%
          </div>
          <div className="mt-1 flex items-center text-xs text-green-400">
            <span>↑ 3.2% from previous period</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: "89.7%" }}
            ></div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Avg. Duration</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-neutral-100">
            3m 42s
          </div>
          <div className="mt-1 flex items-center text-xs text-red-400">
            <span>↑ 12% from previous period</span>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">Deployment Frequency</div>
            <div className="rounded-full bg-neutral-800/50 px-2 py-1 text-xs text-neutral-300">
              Last 30 days
            </div>
          </div>
          <div className="mt-2 text-2xl font-semibold text-neutral-100">
            1.4/day
          </div>
          <div className="mt-1 flex items-center text-xs text-green-400">
            <span>↑ 15% from previous period</span>
          </div>
        </div>
      </div> */}

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
          <Badge variant="outline" className="cursor-pointer">
            <IconFilter className="mr-1 h-3.5 w-3.5" />
            Filter
          </Badge>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Deployments</option>
            <option value="recent">Last 7 Days</option>
            <option value="successful">Successful</option>
            <option value="failed">Failed</option>
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="all">All Components</option>
            <option value="frontend">Frontend</option>
            <option value="api">API</option>
            <option value="backend">Backend</option>
            <option value="database">Database</option>
          </select>
          <select className="rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-300">
            <option value="recent">Most Recent</option>
            <option value="oldest">Oldest First</option>
            <option value="duration">Duration (longest)</option>
            <option value="success">Success Rate</option>
          </select>
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
              <TableRow
                key={deploymentStat.deployment.id}
                className="h-12 cursor-pointer border-b border-neutral-800/50 hover:bg-neutral-800/20"
              >
                <TableCell className="py-3 font-medium text-neutral-200">
                  {deploymentStat.deployment.name}
                </TableCell>
                <TableCell className="py-3 text-neutral-300">
                  {deploymentStat.deployment.tag}
                </TableCell>
                <TableCell className="py-3">
                  <StatusBadge status={deploymentStat.status} />
                </TableCell>
                <TableCell className="py-3 text-neutral-300">
                  {deploymentStat.resourceCount}
                </TableCell>

                <TableCell className="py-3 text-neutral-300">
                  {prettyMilliseconds(deploymentStat.duration, {
                    compact: true,
                  })}
                </TableCell>
                <TableCell className="py-3">
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
                        style={{
                          width: `${Number(deploymentStat.successRate * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm">
                      {Number(deploymentStat.successRate * 100).toFixed(1)}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className=" text-neutral-300">
                  {deploymentStat.deployedBy}
                </TableCell>
                <TableCell className="py-3 text-sm text-neutral-400">
                  {formatDistanceToNow(deploymentStat.deployedAt, {
                    addSuffix: true,
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
