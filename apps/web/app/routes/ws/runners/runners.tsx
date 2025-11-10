import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { JobAgentCard } from "./JobAgentCard";

export function meta() {
  return [
    { title: "Projects - Ctrlplane" },
    {
      name: "description",
      content: "Manage your projects",
    },
  ];
}

export default function Projects() {
  const { workspace } = useWorkspace();
  const jonAgentProviders = trpc.jobAgents.list.useQuery({
    workspaceId: workspace.id,
  });
  const jobAgentProviders = jonAgentProviders.data?.items ?? [];
  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Runners</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2 lg:grid-cols-3">
        {jobAgentProviders.map((jobAgent) => (
          <JobAgentCard key={jobAgent.id} jobAgent={jobAgent} />
        ))}
      </div>
    </>
  );
}
