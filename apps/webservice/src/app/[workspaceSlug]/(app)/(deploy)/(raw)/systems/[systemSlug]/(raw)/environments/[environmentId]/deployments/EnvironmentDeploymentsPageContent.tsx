"use client";

import React, { useState } from "react";
import { useDebounce } from "react-use";

import type { StatusFilter } from "./_components/types";
import { api } from "~/trpc/react";
import { DeploymentsTable } from "./_components/DeploymentsTable";
import { SearchAndFilters } from "./_components/SearchAndFilters";
import { AverageDuration } from "./_components/summary-card/AverageDuration";
import { DeploymentFrequency } from "./_components/summary-card/DeploymentFrequency";
import { SuccessRate } from "./_components/summary-card/SuccessRate";
import { TotalDeployments } from "./_components/summary-card/TotalDeployments";

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

      {/* Deployments Table */}
      <DeploymentsTable
        deploymentStats={deploymentStats}
        isLoading={deploymentStatsQ.isLoading}
      />
    </div>
  );
};
