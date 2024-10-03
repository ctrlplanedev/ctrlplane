"use client";

import type { JobStatus } from "@ctrlplane/validators/jobs";
import React, { Fragment } from "react";
import { IconLoader2 } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import { JobTableStatusIcon } from "~/app/[workspaceSlug]/_components/JobTableStatusIcon";
import { useTargetDrawer } from "~/app/[workspaceSlug]/_components/target-drawer/TargetDrawer";
import { api } from "~/trpc/react";
import { TargetDropdownMenu } from "./TargetDropdownMenu";

type TargetReleaseTableProps = {
  release: { id: string; version: string };
  deploymentName: string;
};

export const TargetReleaseTable: React.FC<TargetReleaseTableProps> = ({
  release,
  deploymentName,
}) => {
  const { setTargetId } = useTargetDrawer();
  const releaseJobTriggerQuery = api.job.config.byReleaseId.useQuery(
    release.id,
    { refetchInterval: 5_000 },
  );
  if (releaseJobTriggerQuery.isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center py-12">
        <IconLoader2 className="animate-spin" size={32} />
      </div>
    );

  return (
    <Table>
      <TableBody>
        {_.chain(releaseJobTriggerQuery.data)
          .groupBy((r) => r.environmentId)
          .entries()
          .map(([envId, jobs]) => (
            <Fragment key={envId}>
              <TableRow className={cn("sticky bg-neutral-800/40")}>
                <TableCell>
                  {jobs[0]?.environment != null && (
                    <div className="flex items-center gap-4">
                      <div className="flex-grow">
                        <strong>{jobs[0].environment.name}</strong>
                      </div>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <strong>Status</strong>
                </TableCell>
                <TableCell>
                  <strong>Type</strong>
                </TableCell>
                <TableCell>
                  <strong>External ID</strong>
                </TableCell>
                <TableCell>
                  <strong>External URL</strong>
                </TableCell>
                <TableCell>
                  <strong>Actions</strong>
                </TableCell>
              </TableRow>
              {jobs.map((job, idx) => (
                <TableRow
                  key={job.id}
                  className={cn(
                    idx !== jobs.length - 1 && "border-b-neutral-800/50",
                  )}
                  onClick={() => job.target?.id && setTargetId(job.target.id)}
                >
                  <TableCell>{job.target?.name}</TableCell>
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
                    {job.job.externalUrl != null ? (
                      <a href={job.job.externalUrl} rel="nofollow noreferrer">
                        {job.job.externalUrl}
                      </a>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        No external URL
                      </span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TargetDropdownMenu
                      release={release}
                      deploymentName={deploymentName}
                      target={job.target}
                      environmentId={job.environmentId}
                      job={{
                        id: job.job.id,
                        status: job.job.status as JobStatus,
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))
          .value()}
      </TableBody>
    </Table>
  );
};
