"use client";

import type { Environment, Target } from "@ctrlplane/db/schema";
import type { JobStatus } from "@ctrlplane/validators/jobs";
import React, { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChevronRight,
  IconDots,
  IconExternalLink,
  IconFilter,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Badge } from "@ctrlplane/ui/badge";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Skeleton } from "@ctrlplane/ui/skeleton";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { JobConditionBadge } from "~/app/[workspaceSlug]/_components/job-condition/JobConditionBadge";
import { JobConditionDialog } from "~/app/[workspaceSlug]/_components/job-condition/JobConditionDialog";
import { useJobFilter } from "~/app/[workspaceSlug]/_components/job-condition/useJobFilter";
import { useJobDrawer } from "~/app/[workspaceSlug]/_components/job-drawer/useJobDrawer";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/_components/JobTableStatusIcon";
import { api } from "~/trpc/react";
import { JobDropdownMenu } from "./JobDropdownMenu";
import { PolicyApprovalRow } from "./PolicyApprovalRow";

type CollapsibleTableRowProps = {
  environment: Environment;
  environmentCount: number;
  deploymentName: string;
  release: {
    id: string;
    version: string;
    name: string;
  };
  releaseJobTriggerData: Array<{
    id: string;
    environmentId: string;
    job: {
      id: string;
      status: JobStatus;
      metadata: Array<{ key: string; value: string }>;
      externalId: string | null;
    };
    target: Target;
    type: string;
  }>;
};

const CollapsibleTableRow: React.FC<CollapsibleTableRowProps> = ({
  environment,
  environmentCount,
  deploymentName,
  release,
  releaseJobTriggerData,
}) => {
  const pathname = usePathname();
  const { setJobId } = useJobDrawer();
  const jobs = releaseJobTriggerData.filter(
    (job) => job.environmentId === environment.id,
  );

  const approvalsQ = api.environment.policy.approval.byReleaseId.useQuery({
    releaseId: release.id,
  });

  const approvals = approvalsQ.data ?? [];
  const environmentApprovals = approvals.filter(
    (approval) => approval.policyId === environment.policyId,
  );

  const isOpen = jobs.length < 10 && environmentCount < 3;
  const [isExpanded, setIsExpanded] = useState(isOpen);

  if (jobs.length === 0) return null;

  return (
    <Fragment>
      <TableRow
        className={cn("sticky cursor-pointer bg-neutral-800/40")}
        onClick={() => setIsExpanded((t) => !t)}
      >
        <TableCell colSpan={6}>
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
                {Object.entries(_.groupBy(jobs, (job) => job.job.status)).map(
                  ([status, groupedJobs]) => (
                    <Badge
                      key={status}
                      variant="outline"
                      className="rounded-full px-1.5 py-0.5"
                      title={capitalCase(status).replace("_", " ")}
                    >
                      <JobTableStatusIcon status={status as JobStatus} />
                      <span className="pl-1">{groupedJobs.length}</span>
                    </Badge>
                  ),
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {environmentApprovals.map((approval) => (
                <PolicyApprovalRow
                  key={approval.id}
                  approval={approval}
                  environment={environment}
                />
              ))}
            </div>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <>
          {jobs.map((job, idx) => {
            const linksMetadata = job.job.metadata.find(
              (m) => m.key === String(ReservedMetadataKey.Links),
            )?.value;

            const links =
              linksMetadata != null
                ? (JSON.parse(linksMetadata) as Record<string, string>)
                : null;

            return (
              <TableRow
                key={job.id}
                className={cn(
                  "cursor-pointer",
                  idx !== jobs.length - 1 && "border-b-neutral-800/50",
                )}
                onClick={() => setJobId(job.job.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Link
                    href={`${pathname}?target_id=${job.target.id}`}
                    className="block w-full hover:text-blue-300"
                  >
                    {job.target.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <JobTableStatusIcon status={job.job.status} />
                    {capitalCase(job.job.status)}
                  </div>
                </TableCell>
                <TableCell>{job.type}</TableCell>
                <TableCell>
                  {job.job.externalId != null ? (
                    <code className="font-mono text-xs">
                      {job.job.externalId}
                    </code>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      No external ID
                    </span>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {links != null && (
                    <div className="flex items-center gap-1">
                      {Object.entries(links).map(([label, url]) => (
                        <Link
                          key={label}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({
                            variant: "secondary",
                            size: "sm",
                            className: "gap-1",
                          })}
                        >
                          <IconExternalLink className="h-4 w-4" />
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end">
                    <JobDropdownMenu
                      release={release}
                      deploymentName={deploymentName}
                      target={job.target}
                      environmentId={job.environmentId}
                      job={{
                        id: job.job.id,
                        status: job.job.status,
                      }}
                    >
                      <Button variant="ghost" size="icon">
                        <IconDots size={16} />
                      </Button>
                    </JobDropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </>
      )}
    </Fragment>
  );
};

type TargetReleaseTableProps = {
  release: { id: string; version: string; name: string };
  deploymentName: string;
  environments: Environment[];
};

export const TargetReleaseTable: React.FC<TargetReleaseTableProps> = ({
  release,
  deploymentName,
  environments,
}) => {
  const { filter, setFilter } = useJobFilter();
  const releaseJobTriggerQuery = api.job.config.byReleaseId.useQuery(
    { releaseId: release.id, filter },
    { refetchInterval: 5_000 },
  );
  const releaseJobTriggers = releaseJobTriggerQuery.data ?? [];

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-800 p-1 px-2">
        <JobConditionDialog condition={filter} onChange={setFilter}>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <IconFilter className="h-4 w-4" />
            </Button>
            {filter != null && <JobConditionBadge condition={filter} />}
          </div>
        </JobConditionDialog>
      </div>

      {releaseJobTriggerQuery.isLoading && (
        <div className="space-y-2 p-4">
          {_.range(30).map((i) => (
            <Skeleton
              key={i}
              className="h-9 w-full"
              style={{ opacity: 1 * (1 - i / 10) }}
            />
          ))}
        </div>
      )}

      {!releaseJobTriggerQuery.isLoading && releaseJobTriggers.length === 0 && (
        <div className="flex w-full items-center justify-center py-8">
          <span className="text-sm text-muted-foreground">
            No jobs found for this release
          </span>
        </div>
      )}

      {!releaseJobTriggerQuery.isLoading && releaseJobTriggers.length > 0 && (
        <Table className="table-fixed">
          <TableBody>
            {environments.map((environment) => (
              <CollapsibleTableRow
                key={environment.id}
                environment={environment}
                environmentCount={environments.length}
                deploymentName={deploymentName}
                release={release}
                releaseJobTriggerData={releaseJobTriggers}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </>
  );
};
