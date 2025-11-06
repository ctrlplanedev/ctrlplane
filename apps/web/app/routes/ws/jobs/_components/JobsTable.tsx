import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import { IconExternalLink } from "@tabler/icons-react";
import prettyMs from "pretty-ms";

import { buttonVariants } from "~/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { cn } from "~/lib/utils";
import { JobActions } from "./JobActions";
import { JobFilters } from "./JobFilters";
import { JobStatusBadge } from "./JobStatusBadge";

type JobsTableProps = {
  jobs: WorkspaceEngine["schemas"]["JobWithRelease"][];
};

function JobsTableHeader() {
  return (
    <TableHeader>
      <TableRow className="bg-muted/50">
        <TableHead className="font-medium">Deployment</TableHead>
        <TableHead className="font-medium">Environment</TableHead>
        <TableHead className="font-medium">Resource</TableHead>
        <TableHead className="font-medium">Version</TableHead>
        <TableHead className="font-medium">External ID</TableHead>
        <TableHead className="font-medium">Status</TableHead>
        <TableHead className="font-medium">Links</TableHead>
        <TableHead className="font-medium">Created</TableHead>
        <TableHead className="font-medium">Updated</TableHead>
        <TableHead />
      </TableRow>
    </TableHeader>
  );
}

function LinksCell({ job }: { job: WorkspaceEngine["schemas"]["Job"] }) {
  const { metadata } = job;
  const links: Record<string, string> =
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    metadata["ctrlplane/links"] != null
      ? JSON.parse(metadata["ctrlplane/links"])
      : {};

  return (
    <TableCell>
      <div className="flex gap-1">
        {Object.entries(links).map(([label, url]) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "secondary", size: "sm" }),
              "flex h-6 max-w-24 items-center gap-1.5 truncate px-2 py-0",
            )}
          >
            {label}
            <IconExternalLink className="size-3 shrink-0" />
          </a>
        ))}
      </div>
    </TableCell>
  );
}

function JobsTableRow({
  jobWithRelease,
}: {
  jobWithRelease: WorkspaceEngine["schemas"]["JobWithRelease"];
}) {
  const { job, resource, environment, deployment, release } = jobWithRelease;
  return (
    <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50">
      <TableCell className="font-medium">
        {deployment?.name ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        {environment?.name ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        {resource?.name ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell className="font-mono  font-medium">
        {release.version.name || release.version.tag}
      </TableCell>
      <TableCell className="font-mono  font-medium">
        {job.externalId ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <JobStatusBadge status={job.status} />
      </TableCell>
      <LinksCell job={job} />
      <TableCell className="text-muted-foreground">
        {prettyMs(Date.now() - new Date(job.createdAt).getTime(), {
          compact: true,
        })}{" "}
        ago
      </TableCell>
      <TableCell className="text-muted-foreground">
        {prettyMs(Date.now() - new Date(job.updatedAt).getTime(), {
          compact: true,
        })}{" "}
        ago
      </TableCell>

      <TableCell className="flex justify-end">
        <JobActions job={jobWithRelease} />
      </TableCell>
    </TableRow>
  );
}

export function JobsTable({ jobs }: JobsTableProps) {
  return (
    <div className="space-y-2 py-2">
      <JobFilters />
      <Table className="border-b">
        <JobsTableHeader />
        <TableBody>
          {jobs.map((jobWithRelease) => (
            <JobsTableRow
              key={jobWithRelease.job.id}
              jobWithRelease={jobWithRelease}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
