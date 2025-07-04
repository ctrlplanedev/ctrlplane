"use client";

import type * as SCHEMA from "@ctrlplane/db/schema";
import React, { useState } from "react";
import {
  IconAlertTriangle,
  IconChevronRight,
  IconDots,
  IconReload,
  IconSwitch,
} from "@tabler/icons-react";
import _ from "lodash";
import { isPresent } from "ts-is-present";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button } from "@ctrlplane/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@ctrlplane/ui/dropdown-menu";
import { TableCell } from "@ctrlplane/ui/table";
import { failedStatuses, JobStatus } from "@ctrlplane/validators/jobs";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/(app)/_components/job/JobTableStatusIcon";
import { OverrideJobStatusDialog } from "~/app/[workspaceSlug]/(app)/_components/job/OverrideJobStatusDialog";
import { api } from "~/trpc/react";
import { CollapsibleRow } from "./CollapsibleRow";
import {
  ForceDeployReleaseTargetsDialog,
  RedeployReleaseTargetsDialog,
} from "./RedeployReleaseTargets";

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

type JobActionsDropdownMenuProps = {
  jobs: { id: string; status: SCHEMA.Job["status"] }[];
  deployment: { id: string; name: string };
  environment: { id: string; name: string };
  releaseTargets: {
    id: string;
    resource: { id: string; name: string };
    latestJob: { id: string; status: JobStatus };
  }[];
};

const JobActionsDropdownMenu: React.FC<JobActionsDropdownMenuProps> = (
  props,
) => {
  const [open, setOpen] = useState(false);
  const { jobs } = props;
  const utils = api.useUtils();

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <IconDots className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <RedeployReleaseTargetsDialog {...props} onClose={() => setOpen(false)}>
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconReload className="h-4 w-4" />
            Redeploy
          </DropdownMenuItem>
        </RedeployReleaseTargetsDialog>
        <ForceDeployReleaseTargetsDialog
          {...props}
          onClose={() => setOpen(false)}
        >
          <DropdownMenuItem
            onSelect={(e) => e.preventDefault()}
            className="flex items-center gap-2"
          >
            <IconAlertTriangle className="h-4 w-4" />
            Force deploy
          </DropdownMenuItem>
        </ForceDeployReleaseTargetsDialog>
        <OverrideJobStatusDialog
          jobs={jobs}
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
  releaseTargets: ReleaseTarget[];
  children: React.ReactNode;
}> = ({ environment, deployment, releaseTargets, children }) => {
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
            <JobActionsDropdownMenu
              jobs={latestJobs}
              deployment={deployment}
              environment={environment}
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
