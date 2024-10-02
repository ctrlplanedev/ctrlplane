import { notFound } from "next/navigation";
import { format } from "date-fns";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ctrlplane/ui/table";

import { api } from "~/trpc/server";
import { JobsGettingStarted } from "./JobsGettingStarted";

export default async function JobsPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.bySlug(params.workspaceSlug);
  if (workspace == null) return notFound();

  const releaseJobTriggers = await api.job.config.byWorkspaceId(workspace.id);

  if (releaseJobTriggers.length === 0) return <JobsGettingStarted />;

  return (
    <div className="scrollbar-thin scrollbar-thumb-neutral-800 scrollbar-track-neutral-900 container mx-auto h-[calc(100vh-40px)] overflow-auto p-6">
      <h1 className="mb-4 text-2xl font-bold">Jobs</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Environment</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Release Version</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created At</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {releaseJobTriggers.map((job) => (
            <TableRow key={job.id}>
              <TableCell>{job.environment?.name ?? "N/A"}</TableCell>
              <TableCell>{job.target?.name ?? "N/A"}</TableCell>
              <TableCell>{job.release.version}</TableCell>
              <TableCell>{job.type}</TableCell>
              <TableCell>{format(new Date(job.createdAt), "PPpp")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
