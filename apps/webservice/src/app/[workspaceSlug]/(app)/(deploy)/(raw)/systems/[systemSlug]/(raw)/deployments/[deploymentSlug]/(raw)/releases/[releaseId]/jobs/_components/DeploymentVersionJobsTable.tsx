"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import {
  IconAlertTriangle,
  IconDots,
  IconMenu2,
  IconReload,
  IconSearch,
  IconSwitch,
} from "@tabler/icons-react";
import { useDebounce } from "react-use";

import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Table, TableBody, TableCell } from "@ctrlplane/ui/table";
import { failedStatuses, JobStatus } from "@ctrlplane/validators/jobs";

import { OverrideJobStatusDialog } from "~/app/[workspaceSlug]/(app)/_components/job/JobDropdownMenu";
import { ForceDeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/ForceDeployVersion";
import { RedeployVersionDialog } from "~/app/[workspaceSlug]/(app)/(deploy)/_components/deployment-version/RedeployVersionDialog";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/react";
import { CollapsibleRow } from "./CollapsibleRow";
import { EnvironmentTableRow } from "./EnvironmentTableRow";
import { ReleaseTargetRow } from "./ReleaseTargetRow";

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

type JobActionsDropdownMenuProps = {
  jobIds: string[];
  deployment: { id: string; name: string };
  environment: { id: string; name: string };
  resource?: { id: string; name: string };
};

const JobActionsDropdownMenu: React.FC<JobActionsDropdownMenuProps> = (
  props,
) => {
  const { jobIds } = props;
  const utils = api.useUtils();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <RedeployVersionDialog {...props}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconReload className="h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        </RedeployVersionDialog>
        <ForceDeployVersionDialog {...props}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconAlertTriangle className="h-4 w-4" />
            Force deploy
          </DropdownMenuItem>
        </ForceDeployVersionDialog>
        <OverrideJobStatusDialog
          jobIds={jobIds}
          onClose={() => utils.deployment.version.job.list.invalidate()}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconSwitch className="h-4 w-4" />
            Override status
          </DropdownMenuItem>
        </OverrideJobStatusDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const DeploymentVersionJobsTable: React.FC<
  DeploymentVersionJobsTableProps
> = ({ deploymentVersion, deployment }) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useDebounce(() => setDebouncedSearch(search), 500, [search]);

  const jobsQuery = api.deployment.version.job.list.useQuery(
    { versionId: deploymentVersion.id, search: debouncedSearch },
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
            {environmentsWithJobs.map(({ environment, releaseTargets }) => (
              <CollapsibleRow
                key={environment.id}
                isInitiallyExpanded={
                  releaseTargets.length <= 5 ||
                  releaseTargets.some(({ jobs }) =>
                    [...failedStatuses, JobStatus.ActionRequired].includes(
                      (jobs.at(0)?.status ?? JobStatus.Pending) as JobStatus,
                    ),
                  )
                }
                Heading={({ isExpanded }) => (
                  <EnvironmentTableRow
                    isExpanded={isExpanded}
                    environment={environment}
                    deployment={deployment}
                    releaseTargets={releaseTargets}
                  />
                )}
                DropdownMenu={
                  <TableCell className="flex justify-end bg-neutral-800/40">
                    <JobActionsDropdownMenu
                      jobIds={releaseTargets.map(({ jobs }) => jobs.at(0)!.id)}
                      deployment={deployment}
                      environment={environment}
                    />
                  </TableCell>
                }
              >
                {releaseTargets.map(({ id, resource, jobs }) => {
                  return (
                    <ReleaseTargetRow
                      key={id}
                      id={id}
                      resource={resource}
                      environment={environment}
                      deployment={deployment}
                      jobs={jobs}
                    />
                  );
                })}
              </CollapsibleRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};
