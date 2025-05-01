"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import { useState } from "react";
import {
  IconPlant,
  IconSearch,
  IconShip,
  IconTopologyComplex,
} from "@tabler/icons-react";
import { useDebounce } from "react-use";

import { Card } from "@ctrlplane/ui/card";
import { Input } from "@ctrlplane/ui/input";

import { api } from "~/trpc/react";
import { EmptySystemsInfo } from "./_components/EmptySystemsInfo";
import { SortDropdown } from "./_components/SortDropdown";
import {
  SystemDeploymentSkeleton,
  SystemHeaderSkeleton,
  SystemTableSkeleton,
} from "./_components/system-deployment-table/SystemDeploymentSkeleton";
import { SystemDeploymentTable } from "./_components/system-deployment-table/SystemDeploymentTable";
import { SystemPageHeader } from "./_components/SystemPageHeader";
import { useSystemCondition } from "./_hooks/useSystemCondition";

const HeaderStatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
}> = ({ icon, label, value }) => (
  <Card>
    <div className="flex items-center gap-4 p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-2xl font-bold">{value}</span>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  </Card>
);

const SearchInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
}> = ({ value, onChange }) => (
  <div className="relative w-full md:w-1/2 lg:w-1/3">
    <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search systems and deployments..."
      className="pl-9"
    />
  </div>
);

export const SystemsPageContent: React.FC<{
  workspace: SCHEMA.Workspace;
}> = ({ workspace }) => {
  const { condition, sort, setCondition, setSort } = useSystemCondition();
  const [search, setSearch] = useState(condition ?? "");

  useDebounce(
    () => {
      if (search !== (condition ?? "")) setCondition(search);
    },
    300,
    [search],
  );

  const workspaceId = workspace.id;
  const query = condition ?? undefined;
  const { data, isLoading } = api.system.list.useQuery(
    { workspaceId, query },
    { placeholderData: (prev) => prev },
  );

  const systems = data?.items ?? [];
  const totalSystems = data?.total ?? 0;

  // Calculate total deployments and environments
  const totalDeployments = systems.reduce(
    (total, system) => total + system.deployments.length,
    0,
  );
  const totalEnvironments = systems.reduce((total, system) => {
    // Assuming an environment count is available on the system object
    // This will need to be adjusted based on your actual data structure
    return total + (system.environments.length || 0);
  }, 0);

  // Sort systems based on the selected sort order
  const sortedSystems = [...systems].sort((a, b) => {
    switch (sort) {
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      case "envs-asc":
        return (a.environments.length || 0) - (b.environments.length || 0);
      case "envs-desc":
        return (b.environments.length || 0) - (a.environments.length || 0);
      default:
        // Default sort is by name ascending
        return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="flex flex-col">
      <SystemPageHeader workspace={workspace} />

      <div className="space-y-8 p-8">
        {/* Only show stats and filters if there are systems */}
        {!isLoading && systems.length > 0 && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <HeaderStatCard
                icon={<IconTopologyComplex className="h-6 w-6 text-primary" />}
                label="Systems"
                value={totalSystems}
              />

              <HeaderStatCard
                icon={<IconShip className="h-6 w-6 text-primary" />}
                label="Deployments"
                value={totalDeployments}
              />

              <HeaderStatCard
                icon={<IconPlant className="h-6 w-6 text-primary" />}
                label="Environments"
                value={totalEnvironments}
              />
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <SearchInput value={search} onChange={setSearch} />
              <SortDropdown value={sort} onChange={setSort} />
            </div>
          </>
        )}

        {/* Empty State */}
        {!isLoading &&
          systems.length === 0 &&
          (search ? (
            <>
              <div className="relative w-full md:w-1/2 lg:w-1/3">
                <IconSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    const { value } = e.target;
                    // If no results, clear the search immediately instead of waiting for debounce
                    // otherwise it will show the empty state below for a split second before clearing
                    if (value.length === 0) {
                      setCondition("");
                      setSearch("");
                    }
                    if (value.length > 0) setSearch(value);
                  }}
                  placeholder="Search systems and deployments..."
                  className="pl-9"
                />
              </div>
              <Card className="flex flex-col items-center justify-center p-12 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/5">
                  <IconTopologyComplex className="h-10 w-10 text-primary/60" />
                </div>
                <h3 className="mb-2 text-xl font-semibold">No systems found</h3>
                <p className="mb-8 max-w-md text-muted-foreground">
                  No systems match your search "{search}". Try a different
                  search term.
                </p>
              </Card>
            </>
          ) : (
            <EmptySystemsInfo workspace={workspace} />
          ))}

        {/* System List */}
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <SystemDeploymentSkeleton
              key={i}
              header={<SystemHeaderSkeleton />}
              table={<SystemTableSkeleton />}
            />
          ))}

        {!isLoading && sortedSystems.length > 0 && (
          <div className="space-y-8">
            {sortedSystems.map((s) => (
              <SystemDeploymentTable
                key={s.id}
                workspace={workspace}
                system={s}
              />
            ))}
          </div>
        )}

        {/* Results Summary */}
        {!isLoading && systems.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {systems.length}{" "}
            {systems.length === 1 ? "system" : "systems"}
            {search && <span> for search "{search}"</span>}
          </div>
        )}
      </div>
    </div>
  );
};
