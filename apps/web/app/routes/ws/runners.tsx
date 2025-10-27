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
      <div className="flex flex-col gap-4">
        {jobAgentProviders.map((jobAgent) => (
          <div key={jobAgent.id}>
            <h3>{jobAgent.name}</h3>
            <p>{jobAgent.type}</p>
            <p>{JSON.stringify(jobAgent.config)}</p>
          </div>
        ))}
      </div>
    </>
  );
}
