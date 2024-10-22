"use client";

import React, { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconDots, IconExternalLink, IconLoader2 } from "@tabler/icons-react";
import { capitalCase } from "change-case";
import _ from "lodash";

import { cn } from "@ctrlplane/ui";
import { Button, buttonVariants } from "@ctrlplane/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";
import { ReservedMetadataKey } from "@ctrlplane/validators/targets";

import { useJobDrawer } from "~/app/[workspaceSlug]/_components/job-drawer/useJobDrawer";
import { JobTableStatusIcon } from "~/app/[workspaceSlug]/_components/JobTableStatusIcon";
import { api } from "~/trpc/react";
import { TargetDropdownMenu } from "./TargetDropdownMenu";

type TargetReleaseTableProps = {
  release: { id: string; version: string; name: string };
  deploymentName: string;
};

export const TargetReleaseTable: React.FC<TargetReleaseTableProps> = ({
  release,
  deploymentName,
}) => {
  const pathname = usePathname();
  const { setJobId } = useJobDrawer();
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
    <Table className="table-fixed">
      <TableBody>
        {_.chain(releaseJobTriggerQuery.data)
          .groupBy((r) => r.environmentId)
          .entries()
          .map(([envId, jobs]) => {
            return (
              <Fragment key={envId}>
                <TableRow className={cn("sticky bg-neutral-800/40")}>
                  <TableCell colSpan={6}>
                    {jobs[0]?.environment != null && (
                      <div className="flex items-center gap-4">
                        <div className="flex-grow">
                          {jobs[0].environment.name}
                        </div>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
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
                      <TableCell className="hover:bg-neutral-800/55">
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
                      <TableCell>
                        <div className="flex justify-end">
                          <TargetDropdownMenu
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
                          </TargetDropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </Fragment>
            );
          })
          .value()}
      </TableBody>
    </Table>
  );
};
