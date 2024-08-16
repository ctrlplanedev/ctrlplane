"use client";

import React from "react";

import { cn } from "@ctrlplane/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/react";

export const JobsTable: React.FC<{ releaseId: string }> = ({ releaseId }) => {
  const jobConfigs = api.job.config.byReleaseId.useQuery(releaseId, {
    refetchInterval: 10_000,
  });
  return (
    <Table>
      <TableHeader></TableHeader>
      <TableBody>
        {jobConfigs.data?.map((job) => (
          <TableRow key={job.id} className={cn("border-b-neutral-800/50")}>
            <TableCell>{job.environment?.name}</TableCell>
            <TableCell>{job.target?.name}</TableCell>
            <TableCell>{job.jobExecution?.status ?? "scheduled"}</TableCell>
            <TableCell>{job.type}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
