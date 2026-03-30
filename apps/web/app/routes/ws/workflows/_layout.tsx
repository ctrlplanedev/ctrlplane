import { Link, Outlet, useParams } from "react-router";

import { trpc } from "~/api/trpc";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Spinner } from "~/components/ui/spinner";
import { useWorkspace } from "~/components/WorkspaceProvider";
import { WorkflowNavbarTabs } from "./_components/WorkflowNavbarTabs";

function WorkflowPageHeader({ name }: { name: string }) {
  const { workspace } = useWorkspace();
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to={`/${workspace.slug}/workflows`}>Workflows</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}

export default function WorkflowLayout() {
  const { workspace } = useWorkspace();
  const { workflowId } = useParams<{ workflowId: string }>();

  const { data: workflow, isLoading } = trpc.workflows.get.useQuery(
    { workspaceId: workspace.id, workflowId: workflowId! },
    { enabled: workflowId != null },
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (workflow == null) {
    throw new Error("Workflow not found");
  }

  return (
    <>
      <WorkflowPageHeader name={workflow.name} />
      <div className="flex justify-end border-b px-4 py-2">
        <WorkflowNavbarTabs />
      </div>
      <Outlet context={workflow} />
    </>
  );
}
