import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";
import { DeploymentFilter } from "./_components/DeploymentFilter";
import { EnvironmentFilter } from "./_components/EnvironmentFilter";
import { JobsTable } from "./_components/JobsTable";
import { ResourceFilter } from "./_components/ResourceFilter";
import { useJobs } from "./hooks";

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

export default function Jobs() {
  const { jobs, isLoading } = useJobs();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex w-full items-center gap-2">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator
            orientation="vertical"
            className="mr-2 shrink-0 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Jobs</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex-1"></div>

          <div className=" flex shrink-0 gap-2">
            <ResourceFilter />
            <EnvironmentFilter />
            <DeploymentFilter />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {isLoading ? <JobsLoadingSkeleton /> : <JobsTable jobs={jobs} />}
      </div>
    </div>
  );
}
