"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import Link from "next/link";
import {
  IconChevronRight,
  IconExternalLink,
  IconMenu2,
  IconSearch,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import { formatDistanceToNowStrict } from "date-fns";
import _ from "lodash";
import { useDebounce } from "react-use";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { SidebarTrigger } from "@ctrlplane/ui/sidebar";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { Sidebars } from "~/app/[workspaceSlug]/sidebars";
import { api } from "~/trpc/react";

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

const CollapsibleRow: React.FC<{
  Heading: React.FC<{ isExpanded: boolean }>;
  children: React.ReactNode;
}> = ({ Heading, children }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <TableRow
        className={cn("sticky")}
        onClick={() => setIsExpanded((t) => !t)}
      >
        <Heading isExpanded={isExpanded} />
      </TableRow>
      {isExpanded && children}
    </>
  );
};

const JobStatusBadge: React.FC<{
  status: SCHEMA.JobStatus;
  count?: number;
}> = ({ status, count = 0 }) => (
  <Badge variant="outline" className="rounded-full px-1.5 py-0.5">
    <JobTableStatusIcon status={status} />
    <span className="pl-1">{count}</span>
  </Badge>
);

const EnvironmentTableRow: React.FC<{
  isExpanded: boolean;
  deployment: { id: string };
  environment: { name: string };
  releaseTargets: Array<{
    id: string;
    resourceId: string;
    jobs: { status: SCHEMA.JobStatus; id: string }[];
  }>;
}> = ({ isExpanded, environment, releaseTargets }) => {
  const statusCounts = _.chain(releaseTargets)
    .map((target) => target.jobs[0]!)
    .countBy((job) => job.status)
    .value();

  return (
    <TableCell colSpan={7} className="bg-neutral-800/40">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <IconChevronRight
            className={cn(
              "h-3 w-3 text-muted-foreground transition-all",
              isExpanded && "rotate-90",
            )}
          />
          {environment.name}
          <div className="flex items-center gap-1.5">
            {Object.entries(statusCounts).map(([status, count]) => (
              <JobStatusBadge
                key={status}
                status={status as SCHEMA.JobStatus}
                count={count}
              />
            ))}
          </div>
        </div>
      </div>
    </TableCell>
  );
};

const JobStatusCell: React.FC<{
  status: SCHEMA.JobStatus;
}> = ({ status }) => (
  <TableCell className="w-26">
    <div className="flex items-center gap-1">
      <JobTableStatusIcon status={status} />
      {capitalCase(status)}
    </div>
  </TableCell>
);

const ExternalIdCell: React.FC<{
  externalId: string | null;
}> = ({ externalId }) => (
  <TableCell>
    {externalId != null ? (
      <code className="font-mono text-xs">{externalId}</code>
    ) : (
      <span className="text-sm text-muted-foreground">No external ID</span>
    )}
  </TableCell>
);

const LinksCell: React.FC<{
  links: Record<string, string>;
}> = ({ links }) => (
  <TableCell onClick={(e) => e.stopPropagation()} className="py-0">
    <div className="flex items-center gap-1">
      {Object.entries(links).map(([label, url]) => (
        <Link
          key={label}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({
            variant: "secondary",
            size: "xs",
            className: "gap-1",
          })}
        >
          <IconExternalLink className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </div>
  </TableCell>
);

const CreatedAtCell: React.FC<{
  createdAt: Date;
}> = ({ createdAt }) => (
  <TableCell>
    {formatDistanceToNowStrict(createdAt, { addSuffix: true })}
  </TableCell>
);

const ReleaseTargetRow: React.FC<{
  id: string;
  resource: { id: string; name: string };
  jobs: Array<{
    id: string;
    status: SCHEMA.JobStatus;
    externalId: string | null;
    links: Record<string, string>;
    createdAt: Date;
  }>;
}> = ({ id, resource, jobs }) => {
  const latestJob = jobs.at(0)!;

  return (
    <CollapsibleRow
      key={id}
      Heading={({ isExpanded }) => (
        <>
          <TableCell className="h-10">
            {jobs.length > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <IconChevronRight
                    className={cn(
                      "h-3 w-3 text-muted-foreground transition-all",
                      isExpanded && "rotate-90",
                    )}
                  />
                </Button>
                {resource.name}
              </div>
            )}

            {jobs.length === 1 && (
              <div className="pl-[29px]">{resource.name}</div>
            )}
          </TableCell>
          <JobStatusCell status={latestJob.status} />
          <ExternalIdCell externalId={latestJob.externalId} />
          <LinksCell links={latestJob.links} />
          <CreatedAtCell createdAt={latestJob.createdAt} />
          <TableCell></TableCell>
        </>
      )}
    >
      {jobs.map((job, idx) => {
        if (idx === 0) return null;
        return (
          <TableRow key={job.id}>
            <TableCell className="p-0">
              <div className="pl-5">
                <div className="h-10 border-l border-neutral-700/50" />
              </div>
            </TableCell>
            <JobStatusCell status={job.status} />
            <ExternalIdCell externalId={job.externalId} />
            <LinksCell links={job.links} />
            <CreatedAtCell createdAt={job.createdAt} />
            <TableCell></TableCell>
          </TableRow>
        );
      })}
    </CollapsibleRow>
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
                Heading={({ isExpanded }) => (
                  <EnvironmentTableRow
                    isExpanded={isExpanded}
                    environment={environment}
                    deployment={deployment}
                    releaseTargets={releaseTargets}
                  />
                )}
              >
                {releaseTargets.map(({ id, resource, jobs }) => {
                  return (
                    <ReleaseTargetRow
                      key={id}
                      id={id}
                      resource={resource}
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
