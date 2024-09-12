"use client";

import { Fragment } from "react";
import { capitalCase } from "change-case";
import _ from "lodash";
import { TbLoader2 } from "react-icons/tb";

import { cn } from "@ctrlplane/ui";
import { Table, TableBody, TableCell, TableRow } from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";
import { JobTableStatusIcon } from "../../../../../../_components/JobTableStatusIcon";

type TargetReleaseTableProps = {
  releaseId: string;
};

export const TargetReleaseTable: React.FC<TargetReleaseTableProps> = ({
  releaseId,
}) => {
  const jobConfigQuery = api.job.config.byReleaseId.useQuery(releaseId, {
    refetchInterval: 5_000,
  });

  if (jobConfigQuery.isLoading)
    return (
      <div className="flex h-full w-full items-center justify-center py-12">
        <TbLoader2 className="animate-spin" size={32} />
      </div>
    );

  return (
    <Table>
      <TableBody>
        {_.chain(jobConfigQuery.data)
          .groupBy((r) => r.environmentId)
          .entries()
          .map(([envId, jobs]) => (
            <Fragment key={envId}>
              <TableRow className={cn("sticky bg-neutral-800/40")}>
                <TableCell colSpan={3}>
                  {jobs[0]?.environment != null && (
                    <div className="flex items-center gap-4">
                      <div className="flex-grow">
                        {jobs[0].environment.name}
                      </div>
                    </div>
                  )}
                </TableCell>
              </TableRow>
              {jobs.map((job, idx) => (
                <TableRow
                  key={job.id}
                  className={cn(
                    idx !== jobs.length - 1 && "border-b-neutral-800/50",
                  )}
                >
                  <TableCell>{job.target?.name}</TableCell>
                  <TableCell className="flex items-center gap-1">
                    <JobTableStatusIcon status={job.jobExecution?.status} />
                    {capitalCase(job.jobExecution?.status ?? "scheduled")}
                  </TableCell>
                  <TableCell>{job.type}</TableCell>
                </TableRow>
              ))}
            </Fragment>
          ))
          .value()}
      </TableBody>
    </Table>
  );
};
