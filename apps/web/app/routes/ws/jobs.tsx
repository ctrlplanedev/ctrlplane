import type { WorkspaceEngine } from "@ctrlplane/workspace-engine-sdk";
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
import { Skeleton } from "~/components/ui/skeleton";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { JobsTable } from "./_components/jobs-table/JobsTable";

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

function JobsLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

function JobsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4">
        <svg
          className="h-8 w-8 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-lg font-semibold">No jobs yet</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Jobs will appear here when deployments are executed
      </p>
    </div>
  );
}

export default function Jobs() {
  const { workspace } = useWorkspace();
  const jobQuery = trpc.jobs.list.useQuery({
    workspaceId: workspace.id,
  });

  const jobs = jobQuery.data?.items ?? [];
  const isLoading = jobQuery.isLoading;

  return (
    <div className="flex h-full flex-col">
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

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <JobsLoadingSkeleton />
        ) : jobs.length === 0 ? (
          <JobsEmptyState />
        ) : (
          <JobsTable jobs={jobs} />
        )}
      </div>
    </div>
  );
}
