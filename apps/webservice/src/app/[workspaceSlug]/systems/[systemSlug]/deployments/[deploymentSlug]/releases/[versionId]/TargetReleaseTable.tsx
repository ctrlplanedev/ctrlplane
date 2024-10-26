"use client";

import type { Environment } from "@ctrlplane/db/schema";
import React, { Fragment, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconChevronRight,
  IconDots,
  IconExternalLink,
  IconLoader2,
} from "@tabler/icons-react";
import { capitalCase } from "change-case";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/conditions";

import { useJobDrawer } from "~/app/[workspaceSlug]/_components/job-drawer/useJobDrawer";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/_components/JobTableStatusIcon";
import { api } from "~/trpc/react";
import { JobDropdownMenu } from "./JobDropdownMenu";
import { PolicyApprovalRow } from "./PolicyApprovalRow";

type CollapsibleTableRowProps = {
  environment: Environment;
  deploymentName: string;
  release: {
    id: string;
    version: string;
    name: string;
  };
};

const CollapsibleTableRow: React.FC<CollapsibleTableRowProps> = ({
  environment,
  deploymentName,
  release,
}) => {
  const { setJobId } = useJobDrawer();
  const pathname = usePathname();
  const [isExpanded, setIsExpanded] = useState(false);

  const releaseJobTriggerQuery = api.job.config.byReleaseId.useQuery(
    release.id,
    { refetchInterval: 5_000 },
  );
  const jobs = releaseJobTriggerQuery.data?.filter(
    (job) => job.environmentId === environment.id,
  );
  const approvals = api.environment.policy.approval.byReleaseId.useQuery({
    releaseId: release.id,
  });
  const environmentApprovals = approvals.data?.filter(
    (approval) => approval.policyId === environment.policyId,
  );

  if (releaseJobTriggerQuery.isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center py-12">
        <IconLoader2 className="animate-spin" size={32} />
      </div>
    );

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
            </div>
            <div className="flex items-center gap-2">
              {environmentApprovals?.map((approval) => (
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
          {jobs?.map((job, idx) => {
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
                <TableCell>
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
                <TableCell>
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
  return (
    <Table className="table-fixed">
      <TableBody>
        {environments.map((environment) => (
          <CollapsibleTableRow
            key={environment.id}
            environment={environment}
            deploymentName={deploymentName}
            release={release}
          />
        ))}
      </TableBody>
    </Table>
  );
};
