import { useWorkspace } from "~/components/WorkspaceProvider";
import { trpc } from "~/api/trpc";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { WorkflowTemplateCard } from "./workflows/_components/WorkflowTemplateCard";


export function meta() {
  return [
    { title: "Workflow Templates - Ctrlplane" },
    {
      name: "description",
      content: "Manage your workflow templates",
    },
  ];
}

function PageHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b pr-4">
      <div className="flex items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Workflows</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  )
}

export default function WorkflowTemplates() {
  const { workspace } = useWorkspace();

  const { data } = trpc.workflows.templates.list.useQuery({  
    workspaceId: workspace.id,
    limit: 100,
    offset: 0,
  });

  const workflowTemplates = data?.items ?? [];

  return (
    <>
      <PageHeader />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {workflowTemplates.map((workflowTemplate) => (
          <WorkflowTemplateCard key={workflowTemplate.id} workflowTemplate={workflowTemplate} />
        ))}
      </div>
    </>
  )
}