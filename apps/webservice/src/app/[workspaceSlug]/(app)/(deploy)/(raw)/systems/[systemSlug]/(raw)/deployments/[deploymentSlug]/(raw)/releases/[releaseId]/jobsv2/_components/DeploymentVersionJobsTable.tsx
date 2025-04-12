"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import { IconMenu2, IconSearch } from "@tabler/icons-react";
import { useDebounce } from "react-use";

import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Table, TableBody } from "@ctrlplane/ui/table";

import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/react";
import { CollapsibleRow } from "./CollapsibleRow";

type DeploymentVersionJobsTableProps = {
  deploymentVersion: {
    id: string;
    tag: string;
    name: string;
    deploymentId: string;
  };
  deployment: SCHEMA.Deployment;
};

const SearchInput: React.FC<{
  value: string;
  onChange: (v: string) => void;
}> = ({ value, onChange }) => (
  <div className="flex items-center">
    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center text-xs text-muted-foreground">
      <IconSearch className="h-4 w-4" />
    </div>

    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      type="text"
      className="w-40 bg-transparent text-sm outline-none"
      placeholder="Search..."
    />
  </div>
);

export const DeploymentVersionJobsTable: React.FC<
  DeploymentVersionJobsTableProps
> = ({ deploymentVersion, deployment }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useDebounce(() => setDebouncedSearch(search), 500, [search]);

  const jobsQuery = api.deployment.version.job.list.useQuery(
    { versionId: deploymentVersion.id, query: debouncedSearch },
    { refetchInterval: 5_000 },
  );
  const environmentsWithJobs = jobsQuery.data ?? [];

  return (
    <>
      <div className="flex items-center border-b border-neutral-800 p-1 px-2">
        <SidebarTrigger name={Sidebars.Release}>
          <IconMenu2 className="h-4 w-4" />
        </SidebarTrigger>

        <SearchInput value={search} onChange={setSearch} />
      </div>

      {jobsQuery.isLoading && (
        <div className="space-y-2 p-4">
          {Array.from({ length: 30 }).map((_, i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 10) }}
            />
          ))}
        </div>
      )}

      {!jobsQuery.isLoading && environmentsWithJobs.length === 0 && (
        <div className="flex w-full items-center justify-center py-8">
          <span className="text-sm text-muted-foreground">
            No jobs found for this version
          </span>
        </div>
      )}

      {environmentsWithJobs.length > 0 && (
        <Table>
          <TableBody>
            {environmentsWithJobs.map((environment) => (
              <CollapsibleRow
                key={environment.id}
                environment={environment}
                deployment={deployment}
                deploymentVersion={deploymentVersion}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};
