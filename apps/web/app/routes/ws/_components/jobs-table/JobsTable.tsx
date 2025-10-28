import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
import prettyMs from "pretty-ms";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { JobActions } from "./JobActions";
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
        <TableHead className="font-medium">Created</TableHead>
        <TableHead className="font-medium">Updated</TableHead>
        <TableHead />
      </TableRow>
    </TableHeader>
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
        {release.version.tag}
      </TableCell>
      <TableCell className="font-mono  font-medium">
        {job.externalId ?? <span className="text-muted-foreground">—</span>}
      </TableCell>
      <TableCell>
        <JobStatusBadge status={job.status} />
      </TableCell>
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
  );
}
