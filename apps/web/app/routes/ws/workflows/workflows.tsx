import { useWorkspace } from "~/components/WorkspaceProvider";
import { trpc } from "~/api/trpc";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";


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
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4">
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

  const { data, isLoading } = trpc.workflows.list.useQuery({  
    workspaceId: workspace.id,
    limit: 100,
    offset: 0,
  });

  return (
    <>
      <PageHeader />
      <div className="flex flex-col gap-4 p-4">
        {data?.items.map((workflowTemplate) => (
          <div key={workflowTemplate.id}>{workflowTemplate.name}</div>
        ))}
      </div>
    </>
  )
}