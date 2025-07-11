"use client";

import React from "react";

import { Skeleton } from "@ctrlplane/ui/skeleton";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import type { ReleaseTarget, Version } from "./types";
import { CollapsibleRow } from "~/app/[workspaceSlug]/(app)/_components/CollapsibleRow";
import { CollapsibleSearchInput } from "~/app/[workspaceSlug]/(app)/_components/CollapsibleSearchInput";
import { api } from "~/trpc/react";
import { HeaderRow } from "./_components/HeaderRow";
import { JobRow } from "./_components/JobRow";
import { VersionDropdown } from "./_components/VersionDropdown";
import { useVersionSearch } from "./useVersionSearch";

const VersionRow: React.FC<{
  version: Version;
  releaseTarget: ReleaseTarget;
}> = ({ version, releaseTarget }) => {
  const [latestJob] = version.jobs;
  const otherJobs = version.jobs.slice(1);

  return (
    <CollapsibleRow
      key={version.id}
      Heading={(props) => (
        <HeaderRow
          {...props}
          releaseTarget={releaseTarget}
          deploymentVersion={version}
          job={latestJob}
        />
      )}
      DropdownMenu={
        <VersionDropdown
          releaseTarget={releaseTarget}
          deploymentVersion={version}
          job={latestJob}
        />
      }
    >
      {otherJobs.map((job) => (
        <JobRow
          key={job.id}
          releaseTargetId={releaseTarget.id}
          versionId={version.id}
          job={job}
        />
      ))}
    </CollapsibleRow>
  );
};

const LoadingState: React.FC = () => (
  <div className="space-y-2 p-4">
    {Array.from({ length: 30 }).map((_, i) => (
      <Skeleton
        key={i}
        className="h-9 w-full"
        style={{ opacity: 1 * (1 - i / 10) }}
      />
    ))}
  </div>
);

const TableHeaderRow: React.FC = () => (
  <TableHeader>
    <TableRow className="h-[49px]">
      <TableHead>Tag</TableHead>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Ran</TableHead>
      <TableHead>Links</TableHead>
      <TableHead />
    </TableRow>
  </TableHeader>
);

export const ReleaseTargetVersionsTable: React.FC<{
  releaseTarget: ReleaseTarget;
}> = ({ releaseTarget }) => {
  const { search, setSearch } = useVersionSearch();
  const { data: versions, isLoading } = api.releaseTarget.version.list.useQuery(
    { releaseTargetId: releaseTarget.id, query: search ?? undefined },
    { refetchInterval: 5_000 },
  );

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-4 border-b border-neutral-800 p-1 px-2 text-sm">
        <CollapsibleSearchInput value={search ?? ""} onChange={setSearch} />
      </div>
      {isLoading && <LoadingState />}

      {!isLoading && (
        <Table>
          <TableHeaderRow />
          <TableBody>
            {versions?.map((version) => (
              <VersionRow
                key={version.id}
                version={version}
                releaseTarget={releaseTarget}
              />
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};
