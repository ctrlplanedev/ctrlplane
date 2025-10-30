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

export function meta() {
  return [
    { title: "Jobs - Ctrlplane" },
    { name: "description", content: "Manage your jobs" },
  ];
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
