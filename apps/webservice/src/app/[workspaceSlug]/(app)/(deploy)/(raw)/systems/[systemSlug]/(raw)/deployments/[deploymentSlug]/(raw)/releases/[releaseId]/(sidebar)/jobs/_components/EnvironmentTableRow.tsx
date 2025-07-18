"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React from "react";
import { IconChevronRight } from "@tabler/icons-react";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { TableCell } from "@ctrlplane/ui/table";
import { failedStatuses, JobStatus } from "@ctrlplane/validators/jobs";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { CollapsibleRow } from "./CollapsibleRow";
import { EnvironmentRowDropdown } from "./EnvironmentRowDropdown";

const JobStatusBadge: React.FC<{
  status: SCHEMA.JobStatus;
  count?: number;
}> = ({ status, count = 0 }) => (
  <Badge variant="outline" className="rounded-full px-1.5 py-0.5">
    <JobTableStatusIcon status={status} />
    <span className="pl-1">{count}</span>
  </Badge>
);

export const EnvironmentTableRow: React.FC<{
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
    .map((target) => target.jobs[0])
    .filter(isPresent)
    .countBy((job) => job.status)
    .value();

  return (
    <TableCell colSpan={5} className="bg-neutral-800/40">
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

type Job = Pick<SCHEMA.Job, "id" | "createdAt" | "status" | "externalId"> & {
  links: Record<string, string>;
};

type ReleaseTarget = SCHEMA.ReleaseTarget & {
  jobs: Job[];
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  resource: SCHEMA.Resource;
};

export const EnvironmentCollapsibleRow: React.FC<{
  environment: SCHEMA.Environment;
  deployment: SCHEMA.Deployment;
  version: { id: string };
  releaseTargets: ReleaseTarget[];
  children: React.ReactNode;
}> = ({ environment, deployment, version, releaseTargets, children }) => {
  const isInitiallyExpanded =
    releaseTargets.length <= 5 ||
    releaseTargets.some(({ jobs }) =>
      [...failedStatuses, JobStatus.ActionRequired].includes(
        (jobs.at(0)?.status ?? JobStatus.Pending) as JobStatus,
      ),
    );

  const releaseTargetsWithLatestJob = releaseTargets
    .filter(({ jobs }) => jobs.length > 0)
    .map((rt) => {
      const latestJob = rt.jobs.at(0)!;
      return {
        ...rt,
        latestJob: {
          id: latestJob.id,
          status: latestJob.status as JobStatus,
        },
      };
    });

  const latestJobs = releaseTargetsWithLatestJob.map(({ jobs }) => jobs.at(0)!);

  return (
    <CollapsibleRow
      key={environment.id}
      isInitiallyExpanded={isInitiallyExpanded}
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
          {
            <EnvironmentRowDropdown
              jobs={latestJobs}
              deployment={deployment}
              environment={environment}
              version={version}
              releaseTargets={releaseTargetsWithLatestJob}
            />
          }
        </TableCell>
      }
    >
      {children}
    </CollapsibleRow>
  );
};
