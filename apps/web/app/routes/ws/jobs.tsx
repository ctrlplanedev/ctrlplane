import prettyMs from "pretty-ms";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { useWorkspace } from "~/components/WorkspaceProvider";

const JobStatusDisplayName = {
  cancelled: "Cancelled",
  skipped: "Skipped",
  inProgress: "In Progress",
  actionRequired: "Action Required",
  pending: "Pending",
  failure: "Failure",
  invalidJobAgent: "Invalid Job Agent",
  invalidIntegration: "Invalid Integration",
  externalRunNotFound: "External Run Not Found",
  successful: "Successful",
};

// Basic job status badge component with color mapping

const JobStatusBadgeColor: Record<string, string> = {
  cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  skipped: "bg-gray-100 text-gray-700 border-gray-200",
  inProgress: "bg-blue-100 text-blue-800 border-blue-200",
  actionRequired: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pending: "bg-muted text-muted-foreground border-muted-foreground/20",
  failure: "bg-red-100 text-red-800 border-red-200",
  invalidJobAgent: "bg-orange-100 text-orange-800 border-orange-200",
  invalidIntegration: "bg-orange-100 text-orange-800 border-orange-200",
  externalRunNotFound: "bg-orange-100 text-orange-800 border-orange-200",
  successful: "bg-green-100 text-green-800 border-green-200",
};

function JobStatusBadge({
  status,
}: {
  status: keyof typeof JobStatusDisplayName;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${JobStatusBadgeColor[status] ?? "border-gray-200 bg-gray-100 text-gray-700"}`}
    >
      {JobStatusDisplayName[status]}
    </span>
  );
}

export default function Jobs() {
  const { workspace } = useWorkspace();
  const jobQuery = trpc.jobs.list.useQuery({
    workspaceId: workspace.id,
  });

  const jobs = jobQuery.data?.items ?? [];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Jobs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-muted-foreground">ID</TableHead>
            <TableHead className="text-muted-foreground">Status</TableHead>
            <TableHead className="text-muted-foreground">Created At</TableHead>
            <TableHead className="text-muted-foreground">Updated At</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {jobs.map(({ job }) => {
            return (
              <TableRow key={job.id}>
                <TableCell className="font-mono">{job.id}</TableCell>
                <TableCell>
                  <JobStatusBadge status={job.status} />
                </TableCell>
                <TableCell>
                  {prettyMs(
                    new Date(job.createdAt).getTime() -
                      new Date(job.updatedAt).getTime(),
                  )}
                </TableCell>
                <TableCell>
                  {prettyMs(
                    new Date(job.updatedAt).getTime() -
                      new Date(job.createdAt).getTime(),
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </>
  );
}
